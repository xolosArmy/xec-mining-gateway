import { Request, Router } from "express";

import { isRmzMember } from "../services/membership";
import { isTokenRevoked } from "../services/session";
import { getWorkerStatusForWallet } from "../services/workers";
import {
  decodeSessionToken,
  revokeSessionToken,
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
    const response: SessionStatusQuery = {
      active: false,
      sessionStatus: "inactive",
      revocationStatus: "unknown",
    };
    return res.json(response);
  }

  const session = decodeSessionToken(token);

  if (!session) {
    const response: SessionStatusQuery = {
      active: false,
      sessionStatus: "inactive",
      revocationStatus: "unknown",
    };
    return res.json(response);
  }

  try {
    const revoked = await isTokenRevoked(token);

    if (revoked) {
      const response: SessionStatusQuery = {
        active: false,
        wallet: session.wallet,
        plan: session.plan,
        expiresAt: new Date(session.exp * 1000).toISOString(),
        membershipValidUntil: session.membershipValidUntil,
        sessionStatus: "inactive",
        revocationStatus: "revoked",
      };
      return res.json(response);
    }
  } catch (error) {
    console.error(
      `Session status revocation check failed for wallet=${session.wallet}: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );

    const response: SessionStatusQuery = {
      active: false,
      wallet: session.wallet,
      plan: session.plan,
      expiresAt: new Date(session.exp * 1000).toISOString(),
      membershipValidUntil: session.membershipValidUntil,
      sessionStatus: "inactive",
      revocationStatus: "unknown",
    };
    return res.json(response);
  }

  const workerStatus = await getWorkerStatusForWallet(session.wallet, session.plan);
  const refreshMembership = req.query.refreshMembership === "true";
  let membershipValidUntil = session.membershipValidUntil;
  let membership;

  if (refreshMembership) {
    membership = await isRmzMember(session.wallet);

    if (membership.validUntil) {
      membershipValidUntil = membership.validUntil;
    }
  }

  const response: SessionStatusQuery = {
    active: true,
    wallet: session.wallet,
    plan: session.plan,
    expiresAt: new Date(session.exp * 1000).toISOString(),
    membershipValidUntil,
    sessionStatus: "active",
    revocationStatus: "not_revoked",
    workerLimit: workerStatus.workerLimit,
    activeWorkers: workerStatus.activeWorkers,
    availableWorkerSlots: workerStatus.availableWorkerSlots,
    workers: workerStatus.workers,
    workerStatus,
    ...(membership ? { membership } : {}),
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
