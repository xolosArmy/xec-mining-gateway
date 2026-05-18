# Membership Gateway Prototype Backend

This backend is the first minimal prototype for the Membership Gateway control plane:

- wallet submits a challenge request
- server creates a nonce-backed challenge
- client submits wallet, challenge ID, and either a mock signature or a Tonalli signature payload
- server performs mock verification or Tonalli signature verification
- server verifies RMZ membership before issuing a session token
- client checks session status
- client revokes the session

## What This Prototype Does

- runs a minimal Express + TypeScript API
- stores challenges in memory
- issues JWT session tokens
- supports session status and session revocation
- preserves mock verification for development
- verifies Tonalli-style signed messages with `ecash-lib`
- enforces mock RMZ membership before session issuance

## What This Prototype Does Not Do Yet

- Stratum mining or gateway logic
- PostgreSQL persistence
- production hardening such as rate limiting or durable audit logs

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The server defaults to `http://localhost:3001`.

## Prototype 7 - Redis Revocation Cache

Prototype 7 adds Redis-backed session revocation shared with `stratum-mock`.

### Local Redis Setup

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
redis-cli ping
```

Expected:

```text
PONG
```

Docker alternative:

```bash
docker run --name xec-mining-redis -p 6379:6379 -d redis:7
```

Environment:

```bash
REDIS_URL=redis://localhost:6379
```

If Redis is unavailable, `POST /v1/session/revoke` returns a clear error and does not pretend the token was revoked.

## Test Health

```bash
curl http://localhost:3001/health
```

## Example Flow

Use a wallet placeholder:

```bash
export WALLET="ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"
```

### 1. Request Challenge

```bash
curl -X POST http://localhost:3001/v1/auth/request-challenge \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$WALLET\"}"
```

Example response:

```json
{
  "challengeId": "7e3b5c5f-6a1c-44ea-9b71-2db943a3fc7a",
  "wallet": "ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
  "nonce": "0d23...",
  "message": "eCash México Mining Gateway Authentication\n\ndomain: ecash.mx\nwallet: ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a\nchallengeId: 7e3b5c5f-6a1c-44ea-9b71-2db943a3fc7a\nnonce: 0d23...\nissuedAt: 2026-05-14T12:00:00.000Z\nexpiresAt: 2026-05-14T12:05:00.000Z\npurpose: mining-gateway-session",
  "issuedAt": "2026-05-14T12:00:00.000Z",
  "expiresAt": "2026-05-14T12:05:00.000Z"
}
```

### 2. Build Mock Signature

The current temporary signature format is:

```text
mock-signature:<wallet>:<challengeId>
```

Example:

```bash
export CHALLENGE_ID="<challengeId from previous response>"
export SIGNATURE="mock-signature:$WALLET:$CHALLENGE_ID"
```

### 3. Verify and Receive Session Token

```bash
curl -X POST http://localhost:3001/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"mock\",\"wallet\":\"$WALLET\",\"challengeId\":\"$CHALLENGE_ID\",\"signature\":\"$SIGNATURE\"}"
```

Example response:

```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "plan": "founding-miner",
  "membership": {
    "active": true,
    "tier": "founding-miner",
    "source": "mock"
  }
}
```

### 4. Check Session Status

```bash
export SESSION_TOKEN="<sessionToken from verify response>"

curl http://localhost:3001/v1/session/status \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

### 5. Revoke Session

```bash
curl -X POST http://localhost:3001/v1/session/revoke \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

## Tonalli Signature Verification Prototype

Tonalli mode keeps the session token format unchanged and adds real signed-message verification for Prototype 4.

### Request a Challenge

```bash
curl -X POST http://localhost:3001/v1/auth/request-challenge \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$WALLET\"}"
```

### Sign the Exact Message in Tonalli Wallet

Sign the exact `message` returned by the backend. Do not change whitespace or line endings.

### Verify with Wallet, Public Key, Signature, and Challenge ID

```bash
export TONALLI_PUBLIC_KEY="<publicKey from Tonalli Connect>"
export TONALLI_SIGNATURE="<signature from Tonalli Wallet signMessage(message)>"

curl -X POST http://localhost:3001/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"tonalli\",\"wallet\":\"$WALLET\",\"challengeId\":\"$CHALLENGE_ID\",\"publicKey\":\"$TONALLI_PUBLIC_KEY\",\"signature\":\"$TONALLI_SIGNATURE\"}"
```

### Manual Verification Helper

After `npm run build`, you can also inspect Tonalli verification locally:

```bash
node dist/scripts/verifyTonalliSignature.js "$WALLET" "$TONALLI_PUBLIC_KEY" "$TONALLI_SIGNATURE" "$MESSAGE"
```

### Notes

- mock mode remains available for development
- Tonalli mode expects a real signature over the exact challenge message
- the prototype derives a P2PKH eCash wallet from the provided public key and compares it to the requested wallet
- both mock and Tonalli modes now require active RMZ membership after signature verification

## Prototype 5 - RMZ Membership Verification Mock

RMZ membership is required before session token issuance.

The current prototype uses a hardcoded approved wallet list.

Approved wallet:

`ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a`

Any other wallet should receive:

`403 RMZ membership required`

### Approved Wallet Example

```bash
export WALLET="ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"
export CHALLENGE_JSON=$(curl -s -X POST http://localhost:3001/v1/auth/request-challenge \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$WALLET\"}")
export CHALLENGE_ID=$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.challengeId);' "$CHALLENGE_JSON")
export SIGNATURE="mock-signature:$WALLET:$CHALLENGE_ID"

curl -X POST http://localhost:3001/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"mock\",\"wallet\":\"$WALLET\",\"challengeId\":\"$CHALLENGE_ID\",\"signature\":\"$SIGNATURE\"}"
```

### Non-Approved Wallet Example

```bash
export WALLET="ecash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq8k9d7x"
export CHALLENGE_JSON=$(curl -s -X POST http://localhost:3001/v1/auth/request-challenge \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$WALLET\"}")
export CHALLENGE_ID=$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.challengeId);' "$CHALLENGE_JSON")
export SIGNATURE="mock-signature:$WALLET:$CHALLENGE_ID"

curl -i -X POST http://localhost:3001/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"mock\",\"wallet\":\"$WALLET\",\"challengeId\":\"$CHALLENGE_ID\",\"signature\":\"$SIGNATURE\"}"
```

## Configuration

Copy `.env.example` to `.env` if you want to override defaults:

```bash
PORT=3001
SESSION_SECRET=change-this-local-development-secret
SESSION_TTL_SECONDS=86400
REDIS_URL=redis://localhost:6379
CHALLENGE_TTL_SECONDS=300
```

The fallback session secret in code is for local development only.

## Prototype 6 - Chronik RMZ Membership Verification

Prototype 6 adds an optional Chronik-backed membership mode without removing the existing mock registry flow.

### Setup

```bash
MEMBERSHIP_MODE=chronik
CHRONIK_URLS=https://chronik.xolosarmy.xyz
RMZ_TOKEN_ID=c923bd0f09c630c5e9980cf518c8d34b6353802a3cb7c3f34fa7cc85c9305908
MIN_RMZ_ATOMS_REQUIRED=10000
```

- `10000` atoms = `1` RMZ
- production can use `25000000` atoms = `2500` RMZ
- the wallet must actually hold enough RMZ to receive a session token

### Chronik Success Example

```bash
export WALLET="<rmz-holding-wallet>"
export CHALLENGE_JSON=$(curl -s -X POST http://localhost:3001/v1/auth/request-challenge \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$WALLET\"}")
export CHALLENGE_ID=$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.challengeId);' "$CHALLENGE_JSON")
export SIGNATURE="mock-signature:$WALLET:$CHALLENGE_ID"

curl -X POST http://localhost:3001/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"mock\",\"wallet\":\"$WALLET\",\"challengeId\":\"$CHALLENGE_ID\",\"signature\":\"$SIGNATURE\"}"
```

Expected result: `membership.source` is `chronik`, `membership.active` is `true`, and the response includes `rmzAtoms`, `rmzRequiredAtoms`, and `tokenId`.

### Chronik Rejection Example

```bash
export WALLET="<wallet-without-rmz>"
export CHALLENGE_JSON=$(curl -s -X POST http://localhost:3001/v1/auth/request-challenge \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$WALLET\"}")
export CHALLENGE_ID=$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.challengeId);' "$CHALLENGE_JSON")
export SIGNATURE="mock-signature:$WALLET:$CHALLENGE_ID"

curl -i -X POST http://localhost:3001/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"mock\",\"wallet\":\"$WALLET\",\"challengeId\":\"$CHALLENGE_ID\",\"signature\":\"$SIGNATURE\"}"
```

Expected result: `403 RMZ membership required`.

## Prototype 9 - Proof of Payment

Prototype 9 adds `MEMBERSHIP_MODE=payment` as the Phase 2 economic prototype while preserving mock mode, Tonalli verification, and the existing Chronik Proof-of-Hold mode.

### Setup

```bash
MEMBERSHIP_MODE=payment
RMZ_TREASURY_ADDRESS=ecash:qq7qn90ev23ecastqmn8as00u8mcp4tzsspvt5dtlk
PAYMENT_WINDOW_DAYS=30
DEFAULT_REQUIRED_PAYMENT_ATOMS=25000000
```

- the wallet must have sent at least `2500` RMZ (`25000000` atoms) to the treasury within the configured payment window
- if `RMZ_TREASURY_ADDRESS` is missing, payment mode rejects access
- payment mode is the production economic direction
