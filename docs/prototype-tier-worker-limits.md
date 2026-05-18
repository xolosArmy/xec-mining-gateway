# Prototype 11 — Tier-based Worker Limits

## Purpose

Prototype 11 makes membership tiers enforceable at the Stratum access layer by limiting how many concurrent workers a wallet can authorize.

## Why tiers must have technical consequences

If all pricing tiers receive the same access once a session token is issued, tiered membership has no operational effect. This prototype turns the tier inside the session token into a concrete technical limit at authorization time.

## Tier Limits

- `base`: 1
- `active`: 5
- `pro`: 20
- `guardian`: 100
- `founding-miner`: 100
- `prototype`: 1

## Flow

Session token issued
-> Stratum decodes tier
-> Stratum counts active workers by wallet
-> Stratum accepts/rejects `mining.authorize`

## TCP Disconnect Cleanup

The Stratum Mock tracks which authorized workers belong to each TCP connection. When a socket closes, ends, or errors, all workers registered to that connection are removed so their slots are released immediately.

## Test Flow

1. Generate base-tier token.
2. Run `worker1`, expect `true`.
3. Run `worker2` with the same wallet/token, expect `false`.
4. Stop `worker1`.
5. Run `worker2` again, expect `true`.

## Limitations

- in-memory worker registry
- not distributed across multiple Stratum instances yet
- no Redis-backed active worker registry yet
- no real ASIC testing yet

## Future

- Redis worker registry
- tier limits across multiple Stratum nodes
- dashboard worker metrics
- per-tier difficulty/priority settings
