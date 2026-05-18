import { ChronikClient } from "chronik-client";
import type { Tx, TxOutput } from "chronik-client";
import { getOutputScriptFromAddress } from "ecashaddrjs";

import { config } from "../config";
import { MembershipStatus } from "../types";

const APPROVED_WALLETS = new Set([
  "ecash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
]);

const chronik = new ChronikClient(config.CHRONIK_URLS);
const HISTORY_PAGE_SIZE = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeWallet = (wallet: string): string => wallet.trim().toLowerCase();

const toBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return BigInt(value.trim());
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }

  throw new Error("Unsupported token amount value");
};

export const getTokenAtomsFromUtxo = (utxo: unknown): bigint => {
  if (!utxo || typeof utxo !== "object") {
    return 0n;
  }

  const candidate = utxo as {
    token?: { tokenId?: unknown; atoms?: unknown };
    slpMeta?: { tokenId?: unknown };
    slpToken?: { amount?: unknown };
  };

  if (
    candidate.token?.tokenId === config.RMZ_TOKEN_ID &&
    candidate.token.atoms !== undefined
  ) {
    return toBigInt(candidate.token.atoms);
  }

  if (
    candidate.slpMeta?.tokenId === config.RMZ_TOKEN_ID &&
    candidate.slpToken?.amount !== undefined
  ) {
    return toBigInt(candidate.slpToken.amount);
  }

  return 0n;
};

export const getTokenAtomsFromTxOutput = (output: unknown): bigint => {
  if (!output || typeof output !== "object") {
    return 0n;
  }

  const candidate = output as {
    token?: { tokenId?: unknown; atoms?: unknown };
  };

  if (
    candidate.token?.tokenId === config.RMZ_TOKEN_ID &&
    candidate.token.atoms !== undefined
  ) {
    return toBigInt(candidate.token.atoms);
  }

  return 0n;
};

const getOutputScriptForAddress = (address: string): string | null => {
  try {
    return getOutputScriptFromAddress(address.trim().toLowerCase()).toLowerCase();
  } catch {
    return null;
  }
};

export const outputMatchesTreasury = (
  output: TxOutput,
  treasuryAddress: string,
): boolean => {
  const treasuryScript = getOutputScriptForAddress(treasuryAddress);

  if (!treasuryScript) {
    return false;
  }

  return output.outputScript.toLowerCase() === treasuryScript;
};

const txSpendsFromWallet = (tx: Tx, wallet: string): boolean => {
  const walletScript = getOutputScriptForAddress(wallet);

  if (!walletScript) {
    return false;
  }

  return tx.inputs.some(
    (input) =>
      typeof input.outputScript === "string" &&
      input.outputScript.toLowerCase() === walletScript,
  );
};

const getTxTimestampMs = (tx: Tx): number | null => {
  if (tx.block?.timestamp && tx.block.timestamp > 0) {
    return tx.block.timestamp * 1000;
  }

  if (tx.timeFirstSeen > 0) {
    return tx.timeFirstSeen * 1000;
  }

  return null;
};

export const txIsWithinPaymentWindow = (tx: Tx, windowDays: number): boolean => {
  const txTimestampMs = getTxTimestampMs(tx);

  // TODO: If Chronik history entries lack timestamps for some edge cases,
  // fall back to a height-based policy once a production rule is defined.
  if (txTimestampMs === null) {
    return false;
  }

  return txTimestampMs >= Date.now() - windowDays * MS_PER_DAY;
};

interface RecentTreasuryPayment {
  paidAtoms: bigint;
  paymentTxid: string;
  paymentTimestamp: string;
  validUntil: string;
}

export const findRecentTreasuryPayment = async (
  wallet: string,
): Promise<RecentTreasuryPayment | null> => {
  const { txs } = await chronik
    .address(wallet)
    .history(0, HISTORY_PAGE_SIZE);

  for (const tx of txs) {
    if (!txIsWithinPaymentWindow(tx, config.PAYMENT_WINDOW_DAYS)) {
      continue;
    }

    if (!txSpendsFromWallet(tx, wallet)) {
      continue;
    }

    for (const output of tx.outputs) {
      if (!outputMatchesTreasury(output, config.RMZ_TREASURY_ADDRESS)) {
        continue;
      }

      const paidAtoms = getTokenAtomsFromTxOutput(output);

      if (paidAtoms < config.DEFAULT_REQUIRED_PAYMENT_ATOMS) {
        continue;
      }

      const txTimestampMs = getTxTimestampMs(tx);

      if (txTimestampMs === null) {
        continue;
      }

      return {
        paidAtoms,
        paymentTxid: tx.txid,
        paymentTimestamp: new Date(txTimestampMs).toISOString(),
        validUntil: new Date(
          txTimestampMs + config.PAYMENT_WINDOW_DAYS * MS_PER_DAY,
        ).toISOString(),
      };
    }
  }

  return null;
};

export const isMockRmzMember = async (
  wallet: string,
): Promise<MembershipStatus> => {
  const normalizedWallet = wallet.trim().toLowerCase();

  // Prototype 5 mock registry remains available for local development.
  if (APPROVED_WALLETS.has(normalizedWallet)) {
    return {
      wallet: normalizedWallet,
      tier: "founding-miner",
      active: true,
      source: "mock",
    };
  }

  return {
    wallet: normalizedWallet,
    tier: "none",
    active: false,
    source: "mock",
  };
};

export const isChronikRmzMember = async (
  wallet: string,
): Promise<MembershipStatus> => {
  const normalizedWallet = normalizeWallet(wallet);

  try {
    const { utxos } = await chronik.address(normalizedWallet).utxos();
    const totalAtoms = utxos.reduce<bigint>(
      (sum, utxo) => sum + getTokenAtomsFromUtxo(utxo),
      0n,
    );

    return {
      wallet: normalizedWallet,
      tier:
        totalAtoms >= config.MIN_RMZ_ATOMS_REQUIRED ? "base" : "none",
      active: totalAtoms >= config.MIN_RMZ_ATOMS_REQUIRED,
      source: "chronik",
      rmzAtoms: totalAtoms.toString(),
      rmzRequiredAtoms: config.MIN_RMZ_ATOMS_REQUIRED.toString(),
      tokenId: config.RMZ_TOKEN_ID,
    };
  } catch {
    return {
      wallet: normalizedWallet,
      tier: "none",
      active: false,
      source: "chronik",
      rmzAtoms: "0",
      rmzRequiredAtoms: config.MIN_RMZ_ATOMS_REQUIRED.toString(),
      tokenId: config.RMZ_TOKEN_ID,
      error: "Chronik membership verification failed",
    };
  }
};

export const isPaymentRmzMember = async (
  wallet: string,
): Promise<MembershipStatus> => {
  const normalizedWallet = normalizeWallet(wallet);
  const treasuryAddress = config.RMZ_TREASURY_ADDRESS;
  const requiredPaymentAtoms = config.DEFAULT_REQUIRED_PAYMENT_ATOMS.toString();

  if (!treasuryAddress) {
    return {
      wallet: normalizedWallet,
      tier: "none",
      active: false,
      source: "payment",
      paymentMode: true,
      treasuryAddress,
      requiredPaymentAtoms,
      paidAtoms: "0",
      windowDays: config.PAYMENT_WINDOW_DAYS,
      tokenId: config.RMZ_TOKEN_ID,
      error: "RMZ treasury address is not configured",
    };
  }

  try {
    const payment = await findRecentTreasuryPayment(normalizedWallet);

    if (!payment) {
      return {
        wallet: normalizedWallet,
        tier: "none",
        active: false,
        source: "payment",
        paymentMode: true,
        treasuryAddress,
        requiredPaymentAtoms,
        paidAtoms: "0",
        windowDays: config.PAYMENT_WINDOW_DAYS,
        tokenId: config.RMZ_TOKEN_ID,
        error: "No recent RMZ treasury payment found",
      };
    }

    return {
      wallet: normalizedWallet,
      tier: "base",
      active: true,
      source: "payment",
      paymentMode: true,
      treasuryAddress,
      requiredPaymentAtoms,
      paidAtoms: payment.paidAtoms.toString(),
      paymentTxid: payment.paymentTxid,
      paymentTimestamp: payment.paymentTimestamp,
      validUntil: payment.validUntil,
      windowDays: config.PAYMENT_WINDOW_DAYS,
      tokenId: config.RMZ_TOKEN_ID,
    };
  } catch {
    return {
      wallet: normalizedWallet,
      tier: "none",
      active: false,
      source: "payment",
      paymentMode: true,
      treasuryAddress,
      requiredPaymentAtoms,
      paidAtoms: "0",
      windowDays: config.PAYMENT_WINDOW_DAYS,
      tokenId: config.RMZ_TOKEN_ID,
      error: "Chronik payment verification failed",
    };
  }
};

export const isRmzMember = async (wallet: string): Promise<MembershipStatus> => {
  switch (config.MEMBERSHIP_MODE) {
    case "mock":
      return isMockRmzMember(wallet);
    case "chronik":
      return isChronikRmzMember(wallet);
    case "payment":
      return isPaymentRmzMember(wallet);
    default:
      return {
        wallet: normalizeWallet(wallet),
        tier: "none",
        active: false,
        source: "mock",
        error: "Unknown membership mode",
      };
  }
};
