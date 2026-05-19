# Roadmap

## Phase 1 Prototype Status

- ✅ Prototype 1 — Membership Gateway Backend
- ✅ Prototype 2 — Membership Portal UI
- ✅ Prototype 3 — Stratum Token Validation Mock
- ✅ Prototype 4 — Tonalli Wallet Signature Verification
- ✅ Prototype 5 — RMZ Membership Verification Mock
- 🎯 Prototype 6 — Chronik RMZ Membership Verification
- 🎯 Prototype 7 — Shared Redis Revocation Cache

## Phase 2 — Decentralized SaaS & Production Billing

- Treasury address deployment
- Chronik Proof-of-Payment verification
- Monthly RMZ membership tiers
- 30-day membership window
- Session token lifecycle tied to payment freshness
- Optional Mining Pass NFT integration
- Treasury dashboard / transparency page
- Production billing audit logs

## Prototype 7 — Shared Redis Revocation Cache

Status: prototype

Scope:

- backend writes revoked token state to Redis
- stratum-mock reads revoked token state from Redis
- token keys are sha256-hashed
- shared revocation works across control plane and data plane

## Prototype 6 — Chronik RMZ Membership Verification

Status: prototype

Scope:

- Chronik RMZ UTXO lookup
- RMZ token ID matching
- atom balance sum
- minimum RMZ atom threshold
- fail-closed membership behavior

Out of scope:

- billing
- token locking/burning
- NFT membership passes
- Redis revocation
- production pool payouts

## Prototype 9 — RMZ Treasury Proof-of-Payment Verification

Status: prototype

Scope:

- payment mode
- treasury address config
- payment window
- RMZ token payment detection
- required atom threshold
- 30-day membership concept

Out of scope:

- production billing dashboard
- full audit logs
- Mining Pass NFT
- worker limits per tier
- automatic treasury accounting

## Prototype 11 — Tier-based Worker Limits

Status: prototype

Scope:

- tier limits in Stratum Mock
- active worker counting per wallet
- TCP disconnect cleanup
- worker rejection when tier limit exceeded

Out of scope:

- distributed worker registry
- real ASIC enforcement
- production pool accounting
- payouts

## Prototype 12 — Miner Dashboard

Status: prototype

Scope:

- Stratum publishes active worker state to Redis
- Backend reads worker count and worker list
- Frontend displays miner dashboard
- Worker limit usage is visible to user

Out of scope:

- public global dashboard
- treasury revenue dashboard
- real ASIC telemetry
- hashrate charts
- production stale worker cleanup

## Strategic Direction

- Membership access is powered by RMZ through Tonalli Wallet.
- RMZ is the required membership layer for gateway access.
- Tonalli Wallet provides identity; RMZ provides membership.
- eCash México builds the infrastructure for the XEC ecosystem.
- Prototype 6 introduces Chronik-based RMZ verification.
- Current Prototype 6 uses Proof of Hold.
- Production Phase 2 moves toward Proof of Payment.

## During Teyolia Campaign

- publish repo
- publish architecture docs
- build Membership Gateway prototype
- build dashboard mockup
- publish weekly updates

## Delivery Philosophy

Phase 1 is intended to establish credible public architecture, membership-gated access design, and a clean path toward a serious mining coordination stack. It is not intended to rush a production mining pool before the control-plane and operational model are clear.
