# Prototype 6 - Chronik RMZ Membership Verification

This prototype currently implements Proof of Hold for development and testing. The production model is expected to evolve toward Proof of Payment, where Chronik verifies recent RMZ membership payments to an eCash México Treasury address.

## Purpose

Prototype 6 adds real on-chain RMZ membership verification to the Membership Gateway while preserving the existing mock path for development and demos.

## RMZ Token ID

`c923bd0f09c630c5e9980cf518c8d34b6353802a3cb7c3f34fa7cc85c9305908`

## Why Chronik Is Used

Chronik provides indexed eCash address and token UTXO lookups, which makes it practical to verify RMZ balances on-chain without placing wallet scanning logic inside the gateway application.

The official Chronik endpoint for this project is `https://chronik.xolosarmy.xyz`.

## Membership Modes

- `mock`: uses the existing hardcoded development registry
- `chronik`: queries Chronik and sums RMZ token atoms held by the wallet

## Environment Variables

- `MEMBERSHIP_MODE`
- `CHRONIK_URLS`
- `RMZ_TOKEN_ID`
- `MIN_RMZ_ATOMS_REQUIRED`

## Atom Conversion

- RMZ has 4 decimals
- 1 RMZ = 10000 atoms
- testing default = 10000 atoms
- production target example = 25000000 atoms = 2500 RMZ

## Flow

Tonalli/mock identity
→ signature verification
→ Chronik RMZ balance check
→ session token
→ Stratum authorize

## Failure Behavior

- insufficient RMZ = `403`
- Chronik failure = fail closed

## Limitations

- no locking or burning yet
- no expiration logic yet
- no NFT pass yet
- no Redis revocation yet

## Future

- paid membership tiers
- RMZ pass NFTs
- Redis revocation
- audit logs
