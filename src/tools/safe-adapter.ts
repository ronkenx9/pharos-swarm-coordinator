import { 
  hashTypedData, 
  verifyTypedData, 
  type Address, 
  type Hex 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { pharosTestnet } from '../chains.js';

export interface SafeTxDetails {
  to: Address;
  value: bigint;
  data: Hex;
  operation: number; // 0 for Call, 1 for DelegateCall
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  nonce: bigint;
}

export const SAFE_TX_TYPES = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

export function getSafeDomain(safeAddress: Address, chainId: number) {
  return {
    chainId,
    verifyingContract: safeAddress,
  } as const;
}

export function calculateSafeTxHash(
  safeAddress: Address,
  tx: SafeTxDetails,
  chainId?: number
): Hex {
  const cid = chainId || pharosTestnet.id;
  return hashTypedData({
    domain: getSafeDomain(safeAddress, cid),
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx',
    message: tx,
  });
}

export async function signSafeTx(
  safeAddress: Address,
  tx: SafeTxDetails,
  privateKey: Hex,
  chainId?: number
): Promise<{ signature: Hex; signer: Address; txHash: Hex }> {
  const cid = chainId || pharosTestnet.id;
  const account = privateKeyToAccount(privateKey);
  
  const signature = await account.signTypedData({
    domain: getSafeDomain(safeAddress, cid),
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx',
    message: tx,
  });

  const txHash = calculateSafeTxHash(safeAddress, tx, cid);

  return {
    signature,
    signer: account.address,
    txHash,
  };
}

export async function verifySafeSignature(
  safeAddress: Address,
  tx: SafeTxDetails,
  signature: Hex,
  signer: Address,
  chainId?: number
): Promise<boolean> {
  const cid = chainId || pharosTestnet.id;
  try {
    const isValid = await verifyTypedData({
      address: signer,
      domain: getSafeDomain(safeAddress, cid),
      types: SAFE_TX_TYPES,
      primaryType: 'SafeTx',
      message: tx,
      signature,
    });
    return isValid;
  } catch (err) {
    console.error('Safe signature validation failed:', err);
    return false;
  }
}
