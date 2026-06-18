# Pharos Swarm Coordinator

> Gnosis Safe multisig propose / sign / execute for Pharos agent swarms.

A Pharos agent Skill that lets a group of agents jointly control a **Gnosis Safe** treasury: propose a transaction, collect co-signatures, and execute on-chain once the threshold is met.

```
PROPOSE ──▶ SIGN ──▶ SIGN ──▶ … ──▶ EXECUTE
 fetch nonce  EIP-712  EIP-712       aggregate + sort + execTransaction
 + tx hash    co-sign  co-sign
```

## What it does
1. **Propose** — reads the Safe's on-chain `nonce` and computes the EIP-712 Safe transaction hash to sign.
2. **Sign** — each agent co-signs the proposed hash with its key.
3. **Execute** — verifies signatures, sorts them by signer address ascending (as Safe requires), concatenates, and submits `execTransaction`.

## Invariants
- **Owner-bound** — only signatures from current Safe owners (`getOwners()`) count; non-owner signatures are ignored.
- **Threshold-aware** — execution reads `getThreshold()` and **refuses to broadcast below threshold**, failing fast with a clear reason instead of reverting on-chain and wasting gas.
- **De-duplicated** — repeated signatures from the same owner collapse to one.
- Signatures are **sorted ascending by signer address** — the ordering Gnosis Safe requires — before execution.
- Nonce is read live from the Safe contract per proposal.

## Actions
`PHAROS_MULTISIG_PROPOSE`, `PHAROS_MULTISIG_SIGN`, `PHAROS_MULTISIG_EXECUTE`, and `PHAROS_MULTISIG_STATUS` (read-only: owners, threshold, nonce — so a swarm knows how many more co-signatures it needs).

## Quickstart
```bash
npm install
cp .env.example .env        # PHAROS_RPC_URL, WALLET_PRIVATE_KEY
npm run build

npm run dev                 # CLI demo
npm run mcp                 # MCP server
```

## Environment
| Var | Required | Purpose |
|---|---|---|
| `PHAROS_RPC_URL` | no (defaults to testnet) | Pharos RPC endpoint |
| `WALLET_PRIVATE_KEY` | yes (to sign/execute) | Signs Safe transactions and submits `execTransaction` |

## Network
Pharos Atlantic testnet — chain id `688689`, RPC `https://atlantic.dplabs-internal.com`, explorer `https://atlantic.pharosscan.xyz`.

## Composition (Phase 2)
Lets a multisig treasury be the **payer** in [`pharos-agent-pay`](https://github.com/ronkenx9/pharos-agent-pay), so a swarm collectively authorizes what it spends on other agents' services.

See [SKILL.md](./SKILL.md) for the full action reference. MIT.
