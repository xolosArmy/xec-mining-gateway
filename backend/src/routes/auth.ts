import { Router } from "express";

import { config } from "../config";
import {
  consumeChallenge,
  createChallenge,
  getChallenge,
} from "../services/challenge";
import { isRmzMember } from "../services/membership";
import { issueSessionToken } from "../services/session";
import {
  verifyMockSignature,
  verifyTonalliSignature,
} from "../services/signature";
import { AuthRequestChallengeBody, AuthVerifyBody } from "../types";

const router = Router();

const toMembershipResponse = (membership: Awaited<ReturnType<typeof isRmzMember>>) => ({
  active: membership.active,
  tier: membership.tier,
  source: membership.source,
  rmzAtoms: membership.rmzAtoms,
  rmzRequiredAtoms: membership.rmzRequiredAtoms,
  tokenId: membership.tokenId,
  paymentMode: membership.paymentMode,
  treasuryAddress: membership.treasuryAddress,
  requiredPaymentAtoms: membership.requiredPaymentAtoms,
  paidAtoms: membership.paidAtoms,
  paymentTxid: membership.paymentTxid,
  paymentTimestamp: membership.paymentTimestamp,
  validUntil: membership.validUntil,
  windowDays: membership.windowDays,
  error: membership.error,
});

router.post("/request-challenge", (req, res) => {
  const { wallet } = req.body as Partial<AuthRequestChallengeBody>;

  if (typeof wallet !== "string" || wallet.trim() === "") {
    return res.status(400).json({ error: "wallet is required and must be a string" });
  }

  const challenge = createChallenge(wallet.trim());

  return res.json({
    challengeId: challenge.id,
    wallet: challenge.wallet,
    nonce: challenge.nonce,
    message: challenge.message,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
  });
});

router.post("/verify", async (req, res) => {
  const {
    mode,
    wallet,
    challengeId,
    signature,
    publicKey,
  } = req.body as Partial<AuthVerifyBody>;

  if (
    (mode !== "mock" && mode !== "tonalli") ||
    typeof wallet !== "string" ||
    wallet.trim() === "" ||
    typeof challengeId !== "string" ||
    challengeId.trim() === "" ||
    typeof signature !== "string" ||
    signature.trim() === ""
  ) {
    return res.status(400).json({
      error: "mode, wallet, challengeId, and signature are required",
    });
  }

  const normalizedWallet = wallet.trim();
  const normalizedChallengeId = challengeId.trim();
  const normalizedSignature = signature.trim();
  const challenge = getChallenge(normalizedChallengeId);

  if (!challenge) {
    return res.status(400).json({ error: "challenge not found or expired" });
  }

  if (challenge.used) {
    return res.status(400).json({ error: "challenge already used" });
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ error: "challenge expired" });
  }

  if (challenge.wallet !== normalizedWallet) {
    return res.status(400).json({ error: "wallet does not match challenge" });
  }

  if (mode === "mock") {
    const isValid = verifyMockSignature({
      wallet: normalizedWallet,
      challengeId: normalizedChallengeId,
      signature: normalizedSignature,
    });

    if (!isValid) {
      return res.status(400).json({ error: "invalid mock signature" });
    }
  }

  if (mode === "tonalli") {
    if (typeof publicKey !== "string" || publicKey.trim() === "") {
      return res.status(400).json({ error: "publicKey is required for tonalli mode" });
    }

    const verification = verifyTonalliSignature({
      wallet: normalizedWallet,
      publicKey: publicKey.trim(),
      signature: normalizedSignature,
      message: challenge.message,
    });

    if (!verification.valid) {
      return res.status(400).json({
        error: verification.reason ?? "invalid Tonalli signature",
        ...(verification.derivedWallet
          ? { derivedWallet: verification.derivedWallet }
          : {}),
      });
    }
  }

  const membership = await isRmzMember(normalizedWallet);

  if (!membership.active) {
    return res.status(403).json({
      error:
        config.MEMBERSHIP_MODE === "payment"
          ? "RMZ membership payment required"
          : "RMZ membership required",
      membership: toMembershipResponse(membership),
    });
  }

  consumeChallenge(normalizedChallengeId);

  const sessionToken = issueSessionToken({
    wallet: normalizedWallet,
    plan: membership.tier,
    membershipValidUntil: membership.validUntil,
  });

  return res.json({
    sessionToken,
    tokenType: "Bearer",
    expiresIn: config.SESSION_TTL_SECONDS,
    plan: membership.tier,
    membership: toMembershipResponse(membership),
  });
});

export default router;
