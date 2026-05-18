export interface ChallengeRecord {
  id: string;
  wallet: string;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
  used: boolean;
}

export type MembershipTier = "founding-miner" | "base" | "none";

export interface MembershipStatus {
  wallet: string;
  tier: MembershipTier;
  active: boolean;
  source: "mock" | "chronik" | "payment";
  rmzAtoms?: string;
  rmzRequiredAtoms?: string;
  tokenId?: string;
  paymentMode?: boolean;
  treasuryAddress?: string;
  requiredPaymentAtoms?: string;
  paidAtoms?: string;
  paymentTxid?: string;
  paymentTimestamp?: string;
  validUntil?: string;
  windowDays?: number;
  error?: string;
}

export interface SessionPayload {
  sub: string;
  wallet: string;
  plan: MembershipTier;
  membershipValidUntil?: string;
  iat: number;
  exp: number;
}

export interface AuthRequestChallengeBody {
  wallet: string;
}

export interface AuthVerifyBody {
  mode: "mock" | "tonalli";
  wallet: string;
  challengeId: string;
  signature: string;
  publicKey?: string;
}

export interface SessionStatusQuery {
  active: boolean;
  wallet?: string;
  plan?: MembershipTier;
  expiresAt?: string;
  membershipValidUntil?: string;
}

export interface RevokeSessionBody {
  token?: string;
}
