export interface ChallengeResponse {
  challengeId: string;
  wallet: string;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

export type VerificationMode = "mock" | "tonalli";

export interface MembershipStatus {
  active: boolean;
  tier: string;
  source: string;
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

export type MembershipResponse = MembershipStatus;

export interface VerifyResponse {
  sessionToken: string;
  tokenType: string;
  expiresIn: number;
  plan: string;
  membership?: MembershipStatus;
}

export interface WorkerSummary {
  workerName: string;
  connectedAt?: string;
  authorized?: boolean;
}

export interface WorkerStatus {
  wallet: string;
  plan: string;
  workerLimit: number;
  activeWorkers: number;
  availableWorkerSlots: number;
  workers: WorkerSummary[];
  source: "redis";
  error?: string;
}

export interface SessionStatusResponse {
  active: boolean;
  wallet?: string;
  plan?: string;
  expiresAt?: string;
  membershipValidUntil?: string;
  sessionStatus?: "active" | "inactive";
  revocationStatus?: "not_revoked" | "revoked" | "unknown";
  workerLimit?: number;
  activeWorkers?: number;
  availableWorkerSlots?: number;
  workers?: WorkerSummary[];
  workerStatus?: WorkerStatus;
  membership?: MembershipStatus;
}

export interface ApiError {
  error: string;
  status?: number;
  membership?: MembershipStatus;
}
