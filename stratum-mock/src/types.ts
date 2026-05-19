export type JsonRpcId = number | string | null;

export interface JsonRpcRequest {
  id: JsonRpcId;
  method: "mining.subscribe" | "mining.authorize" | string;
  params: unknown[];
}

export interface JsonRpcResponse {
  id: JsonRpcId;
  result: unknown;
  error: string | null;
}

export type MiningSubscribeParams = [];

export type MiningAuthorizeParams = [workerName: string, sessionToken: string];

export type StratumMode = "mock" | "proxy";

export type ProxyAuthStrategy = "pass-through" | "upstream-account";

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
