# Economic Model — RMZ-Powered Decentralized SaaS

## Introduction

RMZ is not a symbolic badge.
RMZ is the membership key that sustains real mining infrastructure.

The project requires recurring funding for:

- servers
- Chronik node operation
- Redis/session infrastructure
- monitoring
- bandwidth
- development
- security hardening
- ongoing maintenance

## Current Prototype Model — Proof of Hold

The current prototype verifies whether a wallet holds RMZ using Chronik.

Flow:

Tonalli Wallet identity
→ Chronik checks RMZ balance
→ Gateway issues session token
→ Stratum authorizes worker

This is useful for development and early testing because it avoids payment friction.

But it is not the final production billing model.

## Final Production Model — Proof of Payment

Production will use a Decentralized SaaS model.

Miners will send a monthly RMZ payment to a public eCash México Treasury address.

The Gateway will use Chronik to verify whether the wallet has made a valid recent RMZ payment to the treasury.

If payment is valid and recent, the Gateway issues a mining session token.

If payment is missing or expired, access is rejected.

Flow:

Tonalli Wallet signs challenge
→ Gateway verifies identity
→ Chronik verifies recent RMZ payment to treasury
→ Gateway issues 30-day mining session token
→ Stratum Gateway authorizes worker

## Treasury

The eCash México Treasury address will be public and auditable.

Treasury funds directly support:

- server costs
- Chronik node maintenance
- infrastructure monitoring
- development
- security and reliability work

Treasury address:
TBD

## Monthly Membership Tiers

| Tier | Monthly RMZ | Purpose |
|---|---:|---|
| Base Miner | 2,500 RMZ / month | Basic access, 1 worker |
| Active Miner | 10,000 RMZ / month | Small operations, multiple workers |
| Pro Miner | 25,000 RMZ / month | Serious operations |
| Infrastructure Guardian | 50,000 RMZ+ / month | Premium support / founding tier |

RMZ has 4 decimals.
1 RMZ = 10,000 atoms.

Therefore:

- 2,500 RMZ = 25,000,000 atoms
- 10,000 RMZ = 100,000,000 atoms
- 25,000 RMZ = 250,000,000 atoms
- 50,000 RMZ = 500,000,000 atoms

## Future Technical Implementation

Production billing may be implemented using one or more of these mechanisms:

### Option A — Proof of Payment

Chronik scans recent RMZ token transactions from the miner wallet to the treasury address.

The Gateway checks:

- sender wallet
- treasury recipient
- RMZ token ID
- amount
- timestamp / block height
- membership tier
- payment freshness

### Option B — Mining Pass NFT

Monthly RMZ payment mints or assigns a 30-day Mining Pass NFT.

The Gateway verifies pass ownership through Chronik.

### Option C — Hybrid Model

RMZ payment creates a Mining Pass NFT, and the Gateway verifies the pass instead of scanning payment history every time.

## Why Not Burning First?

Burning RMZ can be powerful as an optional founder ritual or premium badge, but it should not be the first production billing model because infrastructure needs recurring operating cash flow.

## Why Not Locking First?

Locking/staking is useful later, but it is more complex and does not directly fund monthly infrastructure costs.

## Strategic Summary

RMZ is not a symbolic badge. It is the membership key that sustains real mining infrastructure through a Decentralized SaaS model.
