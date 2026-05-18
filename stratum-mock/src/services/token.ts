import crypto from "node:crypto";

import jwt from "jsonwebtoken";

import { config } from "../config";
import { connectRedis } from "./redis";
import { SessionPayload } from "../types";

const buildRevocationKey = (token: string): string => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return `revoked:${tokenHash}`;
};

export const verifySessionToken = async (
  token: string,
): Promise<SessionPayload | null> => {
  if (!token) {
    return null;
  }

  try {
    const client = await connectRedis();
    const revoked = await client.exists(buildRevocationKey(token));

    if (revoked === 1) {
      return null;
    }

    const decoded = jwt.verify(token, config.SESSION_SECRET) as SessionPayload;

    if (
      typeof decoded.wallet !== "string" ||
      (decoded.plan !== undefined && typeof decoded.plan !== "string") ||
      (decoded.membershipValidUntil !== undefined &&
        typeof decoded.membershipValidUntil !== "string") ||
      (decoded.iat !== undefined && typeof decoded.iat !== "number") ||
      (decoded.exp !== undefined && typeof decoded.exp !== "number")
    ) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error(
      `Stratum token validation failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return null;
  }
};
