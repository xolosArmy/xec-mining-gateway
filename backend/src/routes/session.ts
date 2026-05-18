import { Request, Router } from "express";

import {
  decodeSessionToken,
  revokeSessionToken,
  verifySessionToken,
} from "../services/session";
import { SessionStatusQuery } from "../types";

const router = Router();

const extractBearerToken = (req: Request): string | null => {
  const authorization = req.header("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

router.get("/status", async (req, res) => {
  const token = extractBearerToken(req);

  if (!token) {
    const response: SessionStatusQuery = { active: false };
    return res.json(response);
  }

  const session = await verifySessionToken(token);

  if (!session) {
    const response: SessionStatusQuery = { active: false };
    return res.json(response);
  }

  const response: SessionStatusQuery = {
    active: true,
    wallet: session.wallet,
    plan: session.plan,
    expiresAt: new Date(session.exp * 1000).toISOString(),
    membershipValidUntil: session.membershipValidUntil,
  };

  return res.json(response);
});

router.post("/revoke", async (req, res) => {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: "missing or invalid authorization header" });
  }

  const session = decodeSessionToken(token);

  if (!session) {
    return res.status(401).json({ error: "invalid session token" });
  }

  try {
    await revokeSessionToken(token);
  } catch (error) {
    return res.status(503).json({
      error: "session revocation cache unavailable",
      detail: error instanceof Error ? error.message : "unknown redis error",
    });
  }

  return res.json({ revoked: true });
});

export default router;
