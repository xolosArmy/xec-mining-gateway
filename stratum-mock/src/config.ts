import dotenv from "dotenv";

dotenv.config();

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const config = {
  STRATUM_HOST: process.env.STRATUM_HOST ?? "127.0.0.1",
  STRATUM_PORT: parsePort(process.env.STRATUM_PORT, 3333),
  // Local development fallback only. Production must provide a strong secret.
  // This matches the backend fallback so local JWT validation can work end-to-end.
  SESSION_SECRET:
    process.env.SESSION_SECRET ?? "local-development-only-membership-gateway-secret",
  // Redis is used for shared session revocation between Membership Gateway and Stratum Gateway.
  // Local development requires Redis running on localhost:6379.
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  DEFAULT_WORKER:
    process.env.DEFAULT_WORKER ??
    "ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a.worker1",
  WORKER_NAME:
    process.env.WORKER_NAME ??
    process.env.DEFAULT_WORKER ??
    "ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a.worker1",
  SESSION_TOKEN: process.env.SESSION_TOKEN ?? "",
} as const;

export const WORKER_LIMITS: Record<string, number> = {
  base: 1,
  active: 5,
  pro: 20,
  guardian: 100,
  "founding-miner": 100,
  prototype: 1,
};

export const DEFAULT_WORKER_LIMIT = 1;
