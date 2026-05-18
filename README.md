# xec-mining-gateway

Sovereign mining infrastructure for eCash (XEC), led by eCash México and supported by the xolosArmy Network community layer.

This repository contains the technical foundation for the **eCash México Sovereign Mining Infrastructure — Phase 1** Teyolia campaign.

## Mission

eCash needs more than wallets, explorers, and applications.

It needs sovereign infrastructure.

This project aims to build a non-custodial, membership-based mining gateway designed to help decentralize hashrate coordination on XEC.

## Core Principles

- Non-custodial infrastructure
- No private key custody
- Membership-based access
- RMZ-powered Decentralized SaaS model
- Recurring RMZ membership payments sustain infrastructure
- Proof of Hold is the prototype model
- Proof of Payment is the production direction
- Separation of control plane and data plane
- Open-source first
- Built for the eCash ecosystem

## Architecture

The system separates the **Control Plane** from the **Data Plane**.

### Control Plane

Handles:

- wallet authentication
- membership validation
- session token issuance
- worker access permissions

### Data Plane

Handles:

- Stratum traffic
- miner connections
- share submission
- mining coordination

This separation ensures that membership logic does not interfere with mining performance.

## High-Level Flow

```text
Wallet
  ↓
Membership Gateway
  ↓
Session Token
  ↓
ASIC Miner
  ↓
Stratum Gateway
  ↓
Pool Engine
  ↓
eCash Node + Chronik
  ↓
eCash Blockchain
