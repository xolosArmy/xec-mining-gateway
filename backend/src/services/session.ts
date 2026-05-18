import crypto from "node:crypto";

import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

import { config } from "../config";
import { connectRedis } from "./redis";
import { MembershipTier, SessionPayload } from "../types";

interface IssueSessionTokenParams {
  wallet: string;
  plan?: MembershipTier;
  membershipValidUntil?: string;
}

const buildRevocationKey = (token: string): string => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return `revoked:${tokenHash}`;
};

const getRevocationTtlSeconds = (token: string): number => {
  const decoded = jwt.decode(token);

  if (
    typeof decoded === "object" &&
    decoded !== null &&
    typeof decoded.exp === "number"
  ) {
    const remainingSeconds = Math.ceil(decoded.exp - Date.now() / 1000);

    if (Number.isFinite(remainingSeconds) && remainingSeconds > 0) {
      return remainingSeconds;
    }
  }

  return config.SESSION_TTL_SECONDS;
};

export const decodeSessionToken = (token: string): SessionPayload | null => {
  try {
    const decoded = jwt.verify(token, config.SESSION_SECRET) as SessionPayload;

    if (
      typeof decoded.sub !== "string" ||
      typeof decoded.wallet !== "string" ||
      typeof decoded.plan !== "string" ||
      typeof decoded.iat !== "number" ||
      typeof decoded.exp !== "number"
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
};

export const issueSessionToken = ({
  wallet,
  plan = "base",
  membershipValidUntil,
}: IssueSessionTokenParams): string => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + config.SESSION_TTL_SECONDS;

  const payload: SessionPayload = {
    sub: uuidv4(),
    wallet,
    plan,
    ...(membershipValidUntil ? { membershipValidUntil } : {}),
    iat: issuedAt,
    exp: expiresAt,
  };

  return jwt.sign(payload, config.SESSION_SECRET);
};

export const verifySessionToken = async (
  token: string,
): Promise<SessionPayload | null> => {
  try {
    if (await isTokenRevoked(token)) {
      return null;
    }

    return decodeSessionToken(token);
  } catch (error) {
    console.error(
      `Session verification failed while checking Redis revocation cache: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return null;
  }
};

export const revokeSessionToken = async (token: string): Promise<void> => {
  const client = await connectRedis();
  const revocationKey = buildRevocationKey(token);
  const ttlSeconds = getRevocationTtlSeconds(token);

  await client.set(
    revocationKey,
    JSON.stringify({
      revokedAt: new Date().toISOString(),
      reason: "user-revoked",
    }),
    {
      EX: ttlSeconds,
    },
  );
};

export const isTokenRevoked = async (token: string): Promise<boolean> => {
  const client = await connectRedis();
  const revocationKey = buildRevocationKey(token);
  const revoked = await client.exists(revocationKey);

  return revoked === 1;
};
