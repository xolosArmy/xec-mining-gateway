# Prototype 12 — Miner Dashboard

## Purpose

Prototype 12 adds a Miner Dashboard so a user can see whether their mining access is operational before they try to attach more workers.

## Why miner visibility matters

- The wallet is the identity anchor through Tonalli Wallet.
- The membership tier controls how many workers can authorize through the gateway.
- Redis-backed worker visibility lets the control plane show whether a slot is open or already consumed.
- Users can distinguish session problems, membership freshness, and worker-capacity problems without touching Stratum logs first.

## How Stratum publishes workers to Redis

The Stratum Mock keeps its current in-memory worker registry for authorization and limit enforcement.

On successful `mining.authorize`, it also mirrors worker state into Redis:

- `SADD workers:<normalizedWallet> <workerName>`
- `HSET worker:<workerName> workerName <workerName> wallet <wallet> plan <plan> connectedAt <timestamp> authorized true connectionId <connectionId>`

On disconnect or cleanup:

- `SREM workers:<normalizedWallet> <workerName>`
- `DEL worker:<workerName>`

If Redis sync fails, the Stratum Mock keeps serving authorizations and logs that dashboard data may be stale or unavailable.

## How backend reads workers from Redis

`GET /v1/session/status` now reads worker data through `backend/src/services/workers.ts`.

The backend:

- validates the session token
- checks revocation state in Redis
- reads `workers:<wallet>` to count active workers
- reads `worker:<workerName>` for worker summaries
- returns worker usage fields in the session status payload

Optional membership refresh is available through:

`GET /v1/session/status?refreshMembership=true`

This refresh path can call the configured membership verifier and include source, payment, and validity metadata without forcing Chronik lookups on every status request.

## Redis keys

- `workers:<wallet>`
- `worker:<workerName>`

## Dashboard fields

- wallet
- tier
- membership
- validUntil
- paymentTxid
- activeWorkers
- workerLimit
- availableWorkerSlots

## Test flow

1. Generate session token.
2. Check dashboard: `0 / limit` workers.
3. Connect `worker1`.
4. Refresh dashboard: `1 / limit` workers.
5. Connect `worker2` with base tier.
6. Confirm `worker2` is rejected.
7. Disconnect `worker1`.
8. Refresh dashboard: `0 / limit` workers.

## Limitations

- worker registry in Redis is prototype
- not distributed production-ready yet
- no stale worker cleanup job yet
- no real ASIC test yet

## Future

- Redis TTL for workers
- heartbeat and `lastSeen`
- global dashboard
- treasury dashboard
- worker charts
- per-tier analytics
