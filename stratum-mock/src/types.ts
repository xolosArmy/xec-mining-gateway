export interface JsonRpcRequest {
  id: number | string | null;
  method: "mining.subscribe" | "mining.authorize" | string;
  params: unknown[];
}

export interface JsonRpcResponse {
  id: number | string | null;
  result: unknown;
  error: string | null;
}

export type MiningSubscribeParams = [];

export type MiningAuthorizeParams = [workerName: string, sessionToken: string];

export interface WorkerRecord {
  workerName: string;
  wallet: string;
  plan: string;
  connectedAt: string;
  authorized: boolean;
  connectionId?: string;
}

export interface SessionPayload {
  wallet: string;
  sub?: string;
  plan?: string;
  membershipValidUntil?: string;
  iat?: number;
  exp?: number;
}
