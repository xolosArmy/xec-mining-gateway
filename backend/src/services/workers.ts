import { getWorkerLimitForPlan } from "../config";
import { WorkerStatus, WorkerSummary } from "../types";
import { connectRedis } from "./redis";

const normalizeWallet = (wallet: string): string => wallet.trim().toLowerCase();

const getWalletWorkersKey = (wallet: string): string =>
  `workers:${normalizeWallet(wallet)}`;

const getWorkerKey = (workerName: string): string => `worker:${workerName}`;

const toWorkerSummary = (
  workerName: string,
  workerData: Record<string, string>,
): WorkerSummary => ({
  workerName,
  ...(workerData.connectedAt ? { connectedAt: workerData.connectedAt } : {}),
  ...(workerData.authorized
    ? { authorized: workerData.authorized === "true" }
    : {}),
});

export const getWorkerStatusForWallet = async (
  wallet: string,
  plan?: string,
): Promise<WorkerStatus> => {
  const normalizedWallet = normalizeWallet(wallet);
  const normalizedPlan = plan?.trim().toLowerCase() ?? "base";
  const workerLimit = getWorkerLimitForPlan(normalizedPlan);

  try {
    const client = await connectRedis();
    const workerNames = await client.sMembers(getWalletWorkersKey(normalizedWallet));
    const workers: WorkerSummary[] = [];

    for (const workerName of workerNames) {
      const workerData = await client.hGetAll(getWorkerKey(workerName));
      workers.push(toWorkerSummary(workerName, workerData));
    }

    workers.sort((left, right) => {
      const leftConnectedAt = left.connectedAt ?? "";
      const rightConnectedAt = right.connectedAt ?? "";

      return leftConnectedAt.localeCompare(rightConnectedAt);
    });

    const activeWorkers = workers.length;

    return {
      wallet: normalizedWallet,
      plan: normalizedPlan,
      workerLimit,
      activeWorkers,
      availableWorkerSlots: Math.max(workerLimit - activeWorkers, 0),
      workers,
      source: "redis",
    };
  } catch (error) {
    console.error(
      `Worker status lookup failed for wallet=${normalizedWallet}: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );

    return {
      wallet: normalizedWallet,
      plan: normalizedPlan,
      workerLimit,
      activeWorkers: 0,
      availableWorkerSlots: workerLimit,
      workers: [],
      source: "redis",
      error: "Worker status unavailable",
    };
  }
};
