# Membership Gateway

## Purpose

The Membership Gateway is the control-plane service that turns wallet-based identity into miner access. Its purpose is to authenticate a user with a signed wallet challenge, verify RMZ membership status, and issue a time-bounded session token that an ASIC miner can use when connecting to the Stratum Gateway.

This keeps identity and membership logic outside the mining hot path.

Tonalli Wallet provides identity; RMZ provides membership. Membership access is powered by RMZ through Tonalli Wallet.

## Authentication Flow

1. User connects wallet.
2. Server generates challenge.
3. Wallet signs challenge.
4. Backend verifies signature.
5. Backend checks RMZ membership status.
6. Backend issues session token.
7. ASIC uses session token to connect.

## Initial API Draft

### `POST /v1/auth/request-challenge`

Starts the authentication flow by generating a challenge bound to the wallet identity and a short expiration window.

Request sketch:

```json
{
  "wallet": "ecash:qpm2..."
}
```

Response sketch:

```json
{
  "challengeId": "ch_01hxyz",
  "challenge": "Sign this message to authenticate for eCash Mexico mining access.",
  "expiresAt": 1778614261
}
```

### `POST /v1/auth/verify`

Completes challenge verification, checks membership state, and issues a session token when allowed.

Request sketch:

```json
{
  "challengeId": "ch_01hxyz",
  "wallet": "ecash:qpm2...",
  "signature": "base64-or-hex-signature"
}
```

Response sketch:

```json
{
  "status": "ok",
  "sessionToken": "eyJhbGciOi...",
  "expiresAt": 1778617861
}
```

### `GET /v1/session/status`

Returns whether a presented session is active, expired, or revoked.

Response sketch:

```json
{
  "status": "active",
  "wallet": "ecash:qpm2...",
  "plan": "founding-miner",
  "expiresAt": 1778617861
}
```

### `POST /v1/session/revoke`

Revokes a session token before normal expiration and publishes the revocation into a fast cache for gateway enforcement.

Request sketch:

```json
{
  "sessionId": "sess_01hxyz"
}
```

## Session Token Fields

Initial token payload example:

```json
{
  "sub": "sess_01hxyz",
  "wallet": "ecash:qpm2...",
  "plan": "founding-miner",
  "exp": 1778617861,
  "sig": "gateway-signature"
}
```

Field intent:

- `sub`: unique session identifier
- `wallet`: authenticated wallet address
- `plan`: membership tier or access class
- `exp`: expiration timestamp
- `sig`: gateway signature or token integrity proof

## Validation Pseudocode

```text
function verifyWalletLogin(wallet, challengeId, signature):
  challenge = loadChallenge(challengeId)
  if challenge not found:
    reject("unknown challenge")

  if challenge.isExpired():
    reject("expired challenge")

  if challenge.wallet != wallet:
    reject("wallet mismatch")

  if not verifySignature(wallet, challenge.message, signature):
    reject("invalid signature")

  membership = getMembershipStatus(wallet)
  if membership.active != true:
    reject("RMZ membership required")

  session = issueSessionToken(
    wallet = wallet,
    plan = membership.plan,
    expiresAt = now + sessionTTL
  )

  persistSession(session)
  publishSessionToCache(session)

  return session
```

## Membership Notes

RMZ is the required membership layer for gateway access. Tonalli Wallet is the Phase 1 identity wallet. Prototype 6 introduces Chronik-based RMZ verification, while mock mode remains available for development.

Production membership will be RMZ-based and on-chain. Billing, token locking or burning, and NFT pass validation are out of scope for this prototype.

## Membership Model Evolution

Prototype:

- Proof of Hold via Chronik

Production:

- Proof of Payment via Chronik
- monthly RMZ payments to treasury
- possible Mining Pass NFT

## Operational Notes

- Challenge generation and signature verification belong to the control plane.
- Session issuance should produce a token that the Stratum Gateway can validate locally.
- Revocations should propagate quickly through Redis or an equivalent low-latency cache.
- The Membership Gateway should avoid coupling active mining traffic to Chronik or PostgreSQL lookups.
- eCash México builds the infrastructure for the XEC ecosystem.
