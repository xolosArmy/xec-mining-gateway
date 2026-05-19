import dotenv from "dotenv";

dotenv.config();

const MEMBERSHIP_MODES = ["mock", "chronik", "payment"] as const;

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseBigInt = (value: string | undefined, fallback: bigint): bigint => {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  try {
    const parsed = BigInt(value.trim());
    return parsed >= 0n ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseMembershipMode = (
  value: string | undefined,
): (typeof MEMBERSHIP_MODES)[number] => {
  if (typeof value !== "string") {
    return "mock";
  }

  const normalized = value.trim().toLowerCase();

  return MEMBERSHIP_MODES.includes(normalized as (typeof MEMBERSHIP_MODES)[number])
    ? (normalized as (typeof MEMBERSHIP_MODES)[number])
    : "mock";
};

const parseChronikUrls = (value: string | undefined): string[] => {
  const rawValue = value ?? "https://chronik.xolosarmy.xyz";

  return rawValue
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
};

export const WORKER_LIMITS = {
  base: 1,
  active: 5,
  pro: 20,
  guardian: 100,
  "founding-miner": 100,
  prototype: 1,
} as const;

export const DEFAULT_WORKER_LIMIT = 1;

export const getWorkerLimitForPlan = (plan: string | undefined): number => {
  if (typeof plan !== "string") {
    return DEFAULT_WORKER_LIMIT;
  }

  const normalizedPlan = plan.trim().toLowerCase();

  return WORKER_LIMITS[normalizedPlan as keyof typeof WORKER_LIMITS] ?? DEFAULT_WORKER_LIMIT;
};

export const config = {
  PORT: parseNumber(process.env.PORT, 3001),
  // Local development fallback only. Production must provide a strong secret.
  SESSION_SECRET:
    process.env.SESSION_SECRET ?? "local-development-only-membership-gateway-secret",
  SESSION_TTL_SECONDS: parseNumber(process.env.SESSION_TTL_SECONDS, 86400),
  // Redis is used for shared session revocation between Membership Gateway and Stratum Gateway.
  // Local development requires Redis running on localhost:6379.
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  CHALLENGE_TTL_SECONDS: parseNumber(process.env.CHALLENGE_TTL_SECONDS, 300),
  MEMBERSHIP_MODE: parseMembershipMode(process.env.MEMBERSHIP_MODE),
  CHRONIK_URLS: parseChronikUrls(process.env.CHRONIK_URLS),
  RMZ_TOKEN_ID:
    process.env.RMZ_TOKEN_ID ??
    "c923bd0f09c630c5e9980cf518c8d34b6353802a3cb7c3f34fa7cc85c9305908",
  // 10000 atoms = 1 RMZ if RMZ has 4 decimals.
  // Production target may be 25000000 atoms = 2500 RMZ.
  MIN_RMZ_ATOMS_REQUIRED: parseBigInt(
    process.env.MIN_RMZ_ATOMS_REQUIRED,
    10000n,
  ),
  RMZ_TREASURY_ADDRESS:
    process.env.RMZ_TREASURY_ADDRESS?.trim() ??
    "ecash:qq7qn90ev23ecastqmn8as00u8mcp4tzsspvt5dtlk",
  PAYMENT_WINDOW_DAYS: parseNumber(process.env.PAYMENT_WINDOW_DAYS, 30),
  BASE_MINER_RMZ_ATOMS: parseBigInt(
    process.env.BASE_MINER_RMZ_ATOMS,
    25000000n,
  ),
  ACTIVE_MINER_RMZ_ATOMS: parseBigInt(
    process.env.ACTIVE_MINER_RMZ_ATOMS,
    100000000n,
  ),
  PRO_MINER_RMZ_ATOMS: parseBigInt(
    process.env.PRO_MINER_RMZ_ATOMS,
    250000000n,
  ),
  GUARDIAN_RMZ_ATOMS: parseBigInt(
    process.env.GUARDIAN_RMZ_ATOMS,
    500000000n,
  ),
  DEFAULT_REQUIRED_PAYMENT_ATOMS: parseBigInt(
    process.env.DEFAULT_REQUIRED_PAYMENT_ATOMS,
    parseBigInt(process.env.BASE_MINER_RMZ_ATOMS, 25000000n),
  ),
} as const;
