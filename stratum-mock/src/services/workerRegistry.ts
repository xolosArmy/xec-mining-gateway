import { WorkerRecord } from "../types";
import { connectRedis } from "./redis";

const workers = new Map<string, WorkerRecord>();

const normalizeWallet = (wallet: string): string => wallet.trim().toLowerCase();
const getWalletWorkersKey = (wallet: string): string =>
  `workers:${normalizeWallet(wallet)}`;
const getWorkerKey = (workerName: string): string => `worker:${workerName}`;

interface RegisterWorkerParams {
  workerName: string;
  wallet: string;
  plan: string;
  connectedAt: string;
  authorized: boolean;
  connectionId?: string;
}

const syncWorkerRegistrationToRedis = async (
  record: WorkerRecord,
  previousRecord?: WorkerRecord,
): Promise<void> => {
  try {
    const client = await connectRedis();

    if (previousRecord && previousRecord.wallet !== record.wallet) {
      await client.sRem(getWalletWorkersKey(previousRecord.wallet), record.workerName);
    }

    await client.sAdd(getWalletWorkersKey(record.wallet), record.workerName);
    await client.hSet(getWorkerKey(record.workerName), {
      workerName: record.workerName,
      wallet: record.wallet,
      plan: record.plan,
      connectedAt: record.connectedAt,
      authorized: String(record.authorized),
      connectionId: record.connectionId ?? "",
    });
  } catch (error) {
    console.error(
      `Worker registry Redis sync failed on register for worker=${record.workerName}: ${
        error instanceof Error ? error.message : "unknown error"
      }. Dashboard data may be stale or unavailable.`,
    );
  }
};

const syncWorkerRemovalToRedis = async (record: WorkerRecord): Promise<void> => {
  try {
    const client = await connectRedis();
    await client.sRem(getWalletWorkersKey(record.wallet), record.workerName);
    await client.del(getWorkerKey(record.workerName));
  } catch (error) {
    console.error(
      `Worker registry Redis sync failed on remove for worker=${record.workerName}: ${
        error instanceof Error ? error.message : "unknown error"
      }. Dashboard data may be stale or unavailable.`,
    );
  }
};

export const registerWorker = async ({
  workerName,
  wallet,
  plan,
  connectedAt,
  authorized,
  connectionId,
}: RegisterWorkerParams): Promise<WorkerRecord> => {
  const previousRecord = workers.get(workerName);
  const record: WorkerRecord = {
    workerName,
    wallet: normalizeWallet(wallet),
    plan,
    connectedAt,
    authorized,
    connectionId,
  };

  workers.set(workerName, record);
  await syncWorkerRegistrationToRedis(record, previousRecord);

  return record;
};

export const removeWorker = async (workerName: string): Promise<void> => {
  const record = workers.get(workerName);

  if (!record) {
    return;
  }

  workers.delete(workerName);
  await syncWorkerRemovalToRedis(record);
};

export const removeWorkersByConnection = async (
  connectionId: string,
): Promise<void> => {
  const workerNames = Array.from(workers.values())
    .filter((worker) => worker.connectionId === connectionId)
    .map((worker) => worker.workerName);

  await Promise.all(workerNames.map((workerName) => removeWorker(workerName)));
};

export const countActiveWorkersByWallet = (wallet: string): number => {
  const normalizedWallet = normalizeWallet(wallet);

  return Array.from(workers.values()).filter(
    (worker) => worker.wallet === normalizedWallet,
  ).length;
};

export const listWorkers = (): WorkerRecord[] => Array.from(workers.values());

export const getWorkersByWallet = (wallet: string): WorkerRecord[] => {
  const normalizedWallet = normalizeWallet(wallet);

  return Array.from(workers.values()).filter(
    (worker) => worker.wallet === normalizedWallet,
  );
};
