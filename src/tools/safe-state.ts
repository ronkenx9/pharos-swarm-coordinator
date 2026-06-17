import { createPublicClient, http, type Address } from 'viem';
import { pharosTestnet } from '../chains.js';
import { verifySafeSignature, type SafeTxDetails } from './safe-adapter.js';

export const SAFE_STATE_ABI = [
  { name: 'getOwners', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address[]' }] },
  { name: 'getThreshold', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'nonce', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

export interface SafeState {
  owners: Address[];
  threshold: number;
  nonce: bigint;
}

/** Read a Safe's owner set, signing threshold, and current nonce on-chain. */
export async function readSafeState(safeAddress: Address, rpcUrl?: string): Promise<SafeState> {
  const rpc = rpcUrl || process.env.PHAROS_RPC_URL || pharosTestnet.rpcUrls.default.http[0];
  const client = createPublicClient({ chain: pharosTestnet, transport: http(rpc) });

  const [owners, threshold, nonce] = await Promise.all([
    client.readContract({ address: safeAddress, abi: SAFE_STATE_ABI, functionName: 'getOwners' }),
    client.readContract({ address: safeAddress, abi: SAFE_STATE_ABI, functionName: 'getThreshold' }),
    client.readContract({ address: safeAddress, abi: SAFE_STATE_ABI, functionName: 'nonce' }),
  ]);

  return { owners: owners as Address[], threshold: Number(threshold), nonce: nonce as bigint };
}

export interface SignatureInput {
  signer: Address;
  signature: `0x${string}`;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  /** Unique, owner-bound, cryptographically valid signatures. */
  valid: SignatureInput[];
  threshold: number;
  owners: Address[];
}

/**
 * Validate a batch of signatures against the Safe's real owner set and
 * threshold BEFORE broadcasting, so a sub-threshold or non-owner submission
 * fails fast with a clear reason instead of reverting on-chain and wasting gas.
 *
 *  - each signature must be a cryptographically valid SafeTx signature, AND
 *  - its signer must be a current Safe owner, AND
 *  - duplicate signers are collapsed, AND
 *  - the count of unique valid owner-signatures must meet the threshold.
 */
export async function validateSignaturesAgainstSafe(
  safeAddress: Address,
  tx: SafeTxDetails,
  signatures: SignatureInput[],
  state: SafeState
): Promise<ValidationResult> {
  const ownerSet = new Set(state.owners.map((o) => o.toLowerCase()));
  const seen = new Set<string>();
  const valid: SignatureInput[] = [];

  for (const sig of signatures) {
    const signer = sig.signer.toLowerCase();
    if (!ownerSet.has(signer)) continue; // not a Safe owner — ignore
    if (seen.has(signer)) continue; // duplicate signer — ignore
    const isValid = await verifySafeSignature(safeAddress, tx, sig.signature, sig.signer);
    if (!isValid) continue; // bad signature — ignore
    seen.add(signer);
    valid.push(sig);
  }

  if (valid.length < state.threshold) {
    return {
      ok: false,
      reason: `Only ${valid.length} valid owner signature(s); Safe threshold is ${state.threshold}. Refusing to broadcast (would revert).`,
      valid,
      threshold: state.threshold,
      owners: state.owners,
    };
  }

  return { ok: true, valid, threshold: state.threshold, owners: state.owners };
}
