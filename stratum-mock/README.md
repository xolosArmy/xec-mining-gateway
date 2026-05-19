# Prototype 3 - Stratum Token Validation Mock

This prototype simulates a mining worker connecting to a Stratum-like TCP gateway and using the Membership Gateway session token as the worker password.

It demonstrates:

- worker subscribe
- worker authorize
- local JWT validation plus Redis revocation lookup
- accept/reject logic

It does not implement:

- real Stratum mining
- jobs
- shares
- payouts
- ASIC compatibility
- Chronik
- worker disconnect on revocation

## Install

```bash
npm install
```

Redis is now required. `REDIS_URL` must match the backend so both services read and write the same revocation cache.

## Run Server

```bash
cp .env.example .env
# paste SESSION_TOKEN into .env
npm run dev:server
```

## Run Client

In another terminal:

```bash
npm run dev:client
```

## Testing Flow

1. Start backend.
2. Start frontend.
3. Generate session token from Membership Portal UI.
4. Copy token into `stratum-mock/.env` as `SESSION_TOKEN`.
5. Set the same `SESSION_SECRET` and `REDIS_URL` used by the backend.
6. Start Stratum mock server.
7. Run mock miner client.
8. Confirm `mining.authorize` returns `true`.
9. Revoke the session through the backend or frontend.
10. Run the client again and confirm `mining.authorize` returns `false`.

## Important Note

`SESSION_SECRET` in backend and `stratum-mock` must match for JWT validation.

The backend `.env.example` uses `change-this-local-development-secret`, but the backend code also has a local fallback secret of `local-development-only-membership-gateway-secret` in [backend/src/config.ts](/home/xolos-ramirez/xec-mining-gateway/backend/src/config.ts). If the backend is running on that fallback during local tests, set the same value in `stratum-mock/.env` so token verification succeeds.

This mock validates JWTs locally and does not have access to backend in-memory revocation state. Production needs shared Redis-backed revocation storage or another centralized validation cache.

Prototype 7 replaces the old in-memory revocation gap with a shared Redis cache using:

`revoked:<sha256(token)>`

If Redis is unavailable during authorization, the Stratum mock fails closed and returns the same invalid-token response.

## Prototype 11 — Tier-based Worker Limits

The Stratum Mock now reads the membership `plan` or tier from the JWT during `mining.authorize`.

- `base` allows 1 concurrent worker
- higher tiers allow more concurrent workers
- worker slots are counted per wallet
- a TCP disconnect releases the slot for every worker tied to that connection

### Test a second worker rejection

Use the same base-tier token in both terminals and change only `WORKER_NAME`.

Terminal A:

```bash
WORKER_NAME=ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a.worker1 npm run dev:client
```

Terminal B:

```bash
WORKER_NAME=ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a.worker2 npm run dev:client
```

Expected for `base`:

- `worker1` = `true`
- `worker2` = `false`

After closing `worker1`:

- `worker2` = `true`

## Prototype 12 — Miner Dashboard

The Stratum Mock now writes active worker state into Redis in addition to using its in-memory registry for worker-limit enforcement.

- `workers:<wallet>` stores the active worker names for a normalized wallet.
- `worker:<workerName>` stores worker details for dashboard display.
- The backend reads those Redis keys through `GET /v1/session/status`.

### Test dashboard active worker count

1. Start Redis, backend, and frontend.
2. Generate a valid session token from the frontend.
3. Refresh the Miner Dashboard and confirm `0 / limit` workers.
4. Put the token into `stratum-mock/.env` as `SESSION_TOKEN`.
5. Start the Stratum Mock server.
6. Run the worker client and confirm `mining.authorize` returns `true`.
7. Refresh the dashboard and confirm the active worker count increases.
8. Stop the worker client and confirm the count returns to zero after a refresh.
