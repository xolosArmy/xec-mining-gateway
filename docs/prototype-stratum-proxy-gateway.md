# Prototype 13 — Stratum Proxy Gateway

## Purpose

Prototype 13 adds a Stratum proxy mode to the existing gateway so a real miner or ASIC can connect through the local membership control plane before reaching an upstream pool.

## Why proxy mode is the next step before a full pool engine

Proxy mode lets the project test real Stratum traffic flow, token-gated access, Redis-backed revocation, and tier worker enforcement without taking on the scope of a full mining pool engine. It preserves the current control-plane architecture while deferring payouts, share accounting, and block template generation.

## Architecture

ASIC
  ↓
Stratum Proxy Gateway
  ↓ local auth: token/RMZ/tier/Redis
Upstream pool
  ↓
real jobs / shares

## STRATUM_MODE=mock vs STRATUM_MODE=proxy

`mock`

- current prototype behavior
- responds locally to `mining.subscribe`
- validates `mining.authorize` locally
- does not connect to any upstream pool

`proxy`

- intercepts `mining.authorize` locally
- validates session token and Redis revocation
- enforces per-tier worker limits before upstream access
- registers active workers locally and in Redis
- opens an upstream TCP connection and forwards Stratum traffic

## Upstream auth strategies

`upstream-account`

- replaces the upstream `mining.authorize` call with configured `UPSTREAM_STRATUM_USERNAME` and `UPSTREAM_STRATUM_PASSWORD`
- useful when many local miners are routed through one upstream pool account

`pass-through`

- forwards the miner username and password upstream after local authorization succeeds

## Environment variables

- `STRATUM_MODE`
- `STRATUM_HOST`
- `STRATUM_PORT`
- `SESSION_SECRET`
- `REDIS_URL`
- `UPSTREAM_STRATUM_HOST`
- `UPSTREAM_STRATUM_PORT`
- `UPSTREAM_STRATUM_USERNAME`
- `UPSTREAM_STRATUM_PASSWORD`
- `PROXY_AUTH_STRATEGY`

## Test flow with mock upstream or real upstream

### Mock upstream

1. Start Redis.
2. Start backend and frontend.
3. Generate a session token.
4. Start `stratum-mock` upstream test server.
5. Set `STRATUM_MODE=proxy`.
6. Set `UPSTREAM_STRATUM_HOST=127.0.0.1`.
7. Point the proxy at the test upstream port.
8. Start the proxy server.
9. Run the client or miner and confirm subscribe and authorize pass through the proxy.

### Real upstream

1. Configure the real upstream host, port, and credentials.
2. Start the proxy in `STRATUM_MODE=proxy`.
3. Point the miner or ASIC to the local proxy endpoint.
4. Use the session token as the miner password.
5. Watch logs for local auth, upstream connect, upstream authorize, and disconnect cleanup.

## Limitations

- no share accounting
- no payout accounting
- no real pool engine
- no hashrate calculations
- upstream dependency remains
- protocol compatibility not yet ASIC-tested

## Future

- real ASIC S9 test
- share logging
- upstream failover
- per-tier upstream routing
- full pool engine
