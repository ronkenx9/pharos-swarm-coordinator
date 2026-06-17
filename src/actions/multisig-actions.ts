import { z } from 'zod';
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  type Address, 
  type Hex 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { pharosTestnet } from '../chains.js';
import { calculateSafeTxHash, signSafeTx, verifySafeSignature, type SafeTxDetails } from '../tools/safe-adapter.js';
import { readSafeState, validateSignaturesAgainstSafe } from '../tools/safe-state.js';

// Minimal Gnosis Safe ABI for execution & nonce lookup
const SAFE_ABI = [
  {
    name: 'nonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'execTransaction',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const pharosMultisigProposeAction = {
  name: 'PHAROS_MULTISIG_PROPOSE',
  similes: [
    'propose safe transaction',
    'create multisig proposal',
    'generate safe tx hash',
  ],
  description: 'Proposes a Safe transaction, fetches current nonce from the blockchain, and calculates the transaction hash for signing.',
  schema: z.object({
    safe_address: z.string().describe('The Gnosis Safe address on Pharos'),
    to: z.string().describe('The target destination address of the transaction'),
    value: z.string().describe('Amount of native token to send (in Ether, e.g. "0.01")'),
    data: z.string().optional().describe('Calldata for the transaction (hex format). Defaults to "0x"'),
    rpc_url: z.string().optional().describe('Custom RPC URL override'),
  }),
  handler: async (agent: any, input: Record<string, any>) => {
    const { safe_address, to, value, data, rpc_url } = input;
    const rpc = rpc_url || process.env.PHAROS_RPC_URL || pharosTestnet.rpcUrls.default.http[0];

    const client = createPublicClient({
      chain: pharosTestnet,
      transport: http(rpc),
    });

    let nonce = 0n;
    try {
      nonce = await client.readContract({
        address: safe_address as Address,
        abi: SAFE_ABI,
        functionName: 'nonce',
      });
    } catch (err) {
      // Fallback for uninitialized/mock safe contracts in testnet tests
    }

    const txDetails: SafeTxDetails = {
      to: to as Address,
      value: parseEther(value),
      data: (data || '0x') as Hex,
      operation: 0, // Call
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: '0x0000000000000000000000000000000000000000' as Address,
      refundReceiver: '0x0000000000000000000000000000000000000000' as Address,
      nonce,
    };

    const txHash = calculateSafeTxHash(safe_address as Address, txDetails);

    return {
      status: 'success',
      data: {
        txHash,
        safeAddress: safe_address,
        txDetails,
      },
      message: 'Multisig transaction proposed. Hash generated.',
    };
  },
};

export const pharosMultisigSignAction = {
  name: 'PHAROS_MULTISIG_SIGN',
  similes: [
    'sign safe transaction',
    'approve multisig proposal',
    'co-sign transaction hash',
  ],
  description: 'Cryptographically signs a proposed Safe transaction using the agent private key.',
  schema: z.object({
    safe_address: z.string().describe('The Gnosis Safe address'),
    tx_details: z.object({
      to: z.string(),
      value: z.string().describe('Value in wei (string)'),
      data: z.string(),
      operation: z.number(),
      safeTxGas: z.string(),
      baseGas: z.string(),
      gasPrice: z.string(),
      gasToken: z.string(),
      refundReceiver: z.string(),
      nonce: z.string(),
    }).describe('Safe transaction details'),
    private_key: z.string().optional().describe('Private key override. If omitted, uses agent key.'),
  }),
  handler: async (agent: any, input: Record<string, any>) => {
    const { safe_address, tx_details, private_key } = input;
    const key = private_key || agent.privateKey || process.env.WALLET_PRIVATE_KEY;

    if (!key) {
      return {
        status: 'error',
        message: 'Private key missing from signing request.',
      };
    }

    const details: SafeTxDetails = {
      to: tx_details.to as Address,
      value: BigInt(tx_details.value),
      data: tx_details.data as Hex,
      operation: tx_details.operation,
      safeTxGas: BigInt(tx_details.safeTxGas),
      baseGas: BigInt(tx_details.baseGas),
      gasPrice: BigInt(tx_details.gasPrice),
      gasToken: tx_details.gasToken as Address,
      refundReceiver: tx_details.refundReceiver as Address,
      nonce: BigInt(tx_details.nonce),
    };

    const { signature, signer, txHash } = await signSafeTx(
      safe_address as Address,
      details,
      key as Hex
    );

    return {
      status: 'success',
      data: {
        signature,
        signer,
        txHash,
      },
      message: 'Transaction signed successfully.',
    };
  },
};

export const pharosMultisigExecuteAction = {
  name: 'PHAROS_MULTISIG_EXECUTE',
  similes: [
    'submit safe transaction',
    'execute multisig proposal',
  ],
  description: 'Aggregates signatures, sorts them by signer address ascending, and submits the transaction to the Gnosis Safe contract for execution.',
  schema: z.object({
    safe_address: z.string().describe('The Safe address'),
    tx_details: z.object({
      to: z.string(),
      value: z.string(),
      data: z.string(),
      operation: z.number(),
      safeTxGas: z.string(),
      baseGas: z.string(),
      gasPrice: z.string(),
      gasToken: z.string(),
      refundReceiver: z.string(),
      nonce: z.string(),
    }),
    signatures: z.array(z.object({
      signer: z.string().describe('Signer address'),
      signature: z.string().describe('EIP-712 signature hash'),
    })).describe('Accumulated list of co-signatures'),
    rpc_url: z.string().optional().describe('Custom RPC URL override'),
  }),
  handler: async (agent: any, input: Record<string, any>) => {
    const { safe_address, tx_details, signatures, rpc_url } = input;
    const rpc = rpc_url || process.env.PHAROS_RPC_URL || pharosTestnet.rpcUrls.default.http[0];

    const privateKey = agent.privateKey || process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return {
        status: 'error',
        message: 'Agent wallet credentials missing for execution submission.',
      };
    }

    const account = privateKeyToAccount(privateKey as Hex);

    const details: SafeTxDetails = {
      to: tx_details.to as Address,
      value: BigInt(tx_details.value),
      data: tx_details.data as Hex,
      operation: tx_details.operation,
      safeTxGas: BigInt(tx_details.safeTxGas),
      baseGas: BigInt(tx_details.baseGas),
      gasPrice: BigInt(tx_details.gasPrice),
      gasToken: tx_details.gasToken as Address,
      refundReceiver: tx_details.refundReceiver as Address,
      nonce: BigInt(tx_details.nonce),
    };

    // 1. Validate signatures against the Safe's REAL owner set and threshold
    //    before broadcasting, so non-owner or sub-threshold submissions fail
    //    fast with a clear reason instead of reverting on-chain.
    const safeState = await readSafeState(safe_address as Address, rpc);
    const validation = await validateSignaturesAgainstSafe(
      safe_address as Address,
      details,
      signatures.map((s: any) => ({ signer: s.signer as Address, signature: s.signature as Hex })),
      safeState
    );

    if (!validation.ok) {
      return {
        status: 'blocked',
        message: validation.reason,
        data: {
          validSignatures: validation.valid.length,
          threshold: validation.threshold,
          owners: validation.owners,
        },
      };
    }

    // Gnosis Safe requires signatures sorted by signer address ascending
    const verifiedSignatures = [...validation.valid].sort((a, b) =>
      a.signer.toLowerCase().localeCompare(b.signer.toLowerCase())
    );

    // Concatenate signatures into a single byte payload
    const signatureBytes = '0x' + verifiedSignatures.map(s => s.signature.slice(2)).join('') as Hex;

    // 2. Submit transaction on-chain
    try {
      const walletClient = createWalletClient({
        account,
        chain: pharosTestnet,
        transport: http(rpc),
      });

      const hash = await walletClient.writeContract({
        address: safe_address as Address,
        abi: SAFE_ABI,
        functionName: 'execTransaction',
        args: [
          details.to,
          details.value,
          details.data,
          details.operation,
          details.safeTxGas,
          details.baseGas,
          details.gasPrice,
          details.gasToken,
          details.refundReceiver,
          signatureBytes,
        ],
      });

      return {
        status: 'success',
        txHash: hash,
        message: `Multisig transaction submitted successfully. Hash: ${hash}`,
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: `Submission failed: ${err.message || err}`,
      };
    }
  },
};

/**
 * STATUS — read-only introspection of a Safe: owners, signing threshold, and
 * current nonce. Lets a swarm see how many co-signatures it still needs before
 * it can execute.
 */
export const pharosMultisigStatusAction = {
  name: 'PHAROS_MULTISIG_STATUS',
  similes: [
    'get safe owners and threshold',
    'how many signatures does this safe need',
    'inspect multisig configuration',
  ],
  description: 'Reads a Gnosis Safe on Pharos and returns its owners, signing threshold, and current nonce.',
  schema: z.object({
    safe_address: z.string().describe('The Gnosis Safe address'),
    rpc_url: z.string().optional().describe('Custom RPC URL override'),
  }),
  handler: async (_agent: any, input: Record<string, any>) => {
    try {
      const state = await readSafeState(input.safe_address as Address, input.rpc_url);
      return {
        status: 'success',
        data: {
          safeAddress: input.safe_address,
          owners: state.owners,
          ownerCount: state.owners.length,
          threshold: state.threshold,
          nonce: state.nonce.toString(),
        },
        message: `Safe requires ${state.threshold} of ${state.owners.length} owner signatures.`,
      };
    } catch (err: any) {
      return { status: 'error', message: `Could not read Safe state: ${err.message || err}` };
    }
  },
};

export const ACTIONS = {
  PHAROS_MULTISIG_PROPOSE: pharosMultisigProposeAction,
  PHAROS_MULTISIG_SIGN: pharosMultisigSignAction,
  PHAROS_MULTISIG_EXECUTE: pharosMultisigExecuteAction,
  PHAROS_MULTISIG_STATUS: pharosMultisigStatusAction,
};
