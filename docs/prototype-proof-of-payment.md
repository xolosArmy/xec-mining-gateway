# Prototype 9 — RMZ Treasury Proof-of-Payment Verification

## Purpose

Prototype 9 adds a Phase 2 membership mode where the gateway verifies a recent RMZ payment to the public eCash México Treasury before issuing mining access.

## Why Phase 2 Moves from Proof of Hold to Proof of Payment

Proof of Hold was useful for early testing because it removed billing friction while proving the Tonalli, Chronik, gateway, and Stratum flow.

Phase 2 introduces the production economic direction:

- miners pay monthly RMZ to the treasury
- Chronik verifies recent qualifying payment activity
- the gateway issues access only after payment verification

## Treasury Address Requirement

`RMZ_TREASURY_ADDRESS` must be configured before `MEMBERSHIP_MODE=payment` can authorize any wallet.

Default treasury address for this prototype:

`ecash:qq7qn90ev23ecastqmn8as00u8mcp4tzsspvt5dtlk`

If the treasury address is missing, the backend fails closed and returns:

```json
{
  "error": "RMZ membership payment required",
  "membership": {
    "active": false,
    "source": "payment",
    "error": "RMZ treasury address is not configured"
  }
}
```

## Monthly Tiers

- Base Miner: 2,500 RMZ
- Active Miner: 10,000 RMZ
- Pro Miner: 25,000 RMZ
- Guardian: 50,000 RMZ

Prototype 9 currently authorizes against `DEFAULT_REQUIRED_PAYMENT_ATOMS`, which defaults to the Base Miner tier.

## Atom Conversions

- 1 RMZ = 10,000 atoms
- 2,500 RMZ = 25,000,000 atoms
- 10,000 RMZ = 100,000,000 atoms
- 25,000 RMZ = 250,000,000 atoms
- 50,000 RMZ = 500,000,000 atoms

## Environment Variables

- `MEMBERSHIP_MODE=payment`
- `RMZ_TREASURY_ADDRESS`
- `PAYMENT_WINDOW_DAYS`
- `DEFAULT_REQUIRED_PAYMENT_ATOMS`

## Flow

Tonalli Wallet signs challenge
→ Gateway verifies identity
→ Chronik checks recent RMZ payment to treasury
→ Gateway issues session token
→ Stratum authorizes worker

## Success Response Example

```json
{
  "sessionToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "plan": "base",
  "membership": {
    "active": true,
    "tier": "base",
    "source": "payment",
    "paymentMode": true,
    "treasuryAddress": "ecash:qq7qn90ev23ecastqmn8as00u8mcp4tzsspvt5dtlk",
    "requiredPaymentAtoms": "25000000",
    "paidAtoms": "25000000",
    "paymentTxid": "<txid>",
    "paymentTimestamp": "2026-05-18T00:00:00.000Z",
    "validUntil": "2026-06-17T00:00:00.000Z",
    "windowDays": 30,
    "tokenId": "c923bd0f09c630c5e9980cf518c8d34b6353802a3cb7c3f34fa7cc85c9305908"
  }
}
```

## Failure Response Example

```json
{
  "error": "RMZ membership payment required",
  "membership": {
    "active": false,
    "tier": "none",
    "source": "payment",
    "paymentMode": true,
    "treasuryAddress": "ecash:qq7qn90ev23ecastqmn8as00u8mcp4tzsspvt5dtlk",
    "requiredPaymentAtoms": "25000000",
    "paidAtoms": "0",
    "windowDays": 30,
    "tokenId": "c923bd0f09c630c5e9980cf518c8d34b6353802a3cb7c3f34fa7cc85c9305908",
    "error": "No recent RMZ treasury payment found"
  }
}
```

## Limitations

- first-page history / pagination may be incomplete
- output address parsing depends on Chronik response shape
- no Mining Pass NFT yet
- no treasury dashboard yet
- no billing audit log yet

## Future Production

- full transaction pagination
- treasury dashboard
- payment receipts
- Mining Pass NFT
- tier-specific worker limits
- audit logs
