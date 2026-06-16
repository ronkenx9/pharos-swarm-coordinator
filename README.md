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
- Signatures are **verified** before submission; invalid ones are dropped.
- Signatures are **sorted ascending by signer address** — the ordering Gnosis Safe requires — before execution.
- Nonce is read live from the Safe contract per proposal.

## Actions
`PHAROS_MULTISIG_PROPOSE`, `PHAROS_MULTISIG_SIGN`, `PHAROS_MULTISIG_EXECUTE`.

## Quickstart
```bash
npm install
cp .env.example .env        # PHAROS_RPC_URL, WALLET_PRIVATE_KEY
npm run build

npm run dev                 # CLI demo
npm run mcp                 # MCP server
```

## Network
Pharos Atlantic testnet — chain id `688689`, RPC `https://atlantic.dplabs-internal.com`, explorer `https://atlantic.pharosscan.xyz`.

## Composition (Phase 2)
Lets a multisig treasury be the **payer** in [`pharos-agent-pay`](https://github.com/ronkenx9/pharos-agent-pay), so a swarm collectively authorizes what it spends on other agents' services.

See [SKILL.md](./SKILL.md) for the full action reference. MIT.
