---
name: pharos-swarm-coordinator
version: 1.0.0
description: Proposes, signs, and executes Gnosis Safe transactions on Pharos Network.
authors:
  - roninxx
tags:
  - pharos
  - multisig
  - safe
  - swarm
  - coordinator
frameworks:
  - claude-code
  - codex
  - mcp
---

# Pharos Swarm Multisig Coordinator

A treasury adapter that allows agent groups/swarms to proposal, sign, and execute transactions on a Gnosis Safe multisig wallet deployed on Pharos Network.

## Trigger Phrases
- "Propose multisig transaction to [address] for [amount] ETH"
- "Sign safe transaction hash [hash]"
- "Submit multi-sig proposal with signatures [signatures]"
- "Co-sign safe tx to [recipient]"

## Nonces & Order
Signatures must be sorted by signer address ascending before execution.
