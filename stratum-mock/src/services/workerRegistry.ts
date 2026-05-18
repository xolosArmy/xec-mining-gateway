import { WorkerRecord } from "../types";

const workers = new Map<string, WorkerRecord>();

const normalizeWallet = (wallet: string): string => wallet.trim().toLowerCase();

interface RegisterWorkerParams {
  workerName: string;
  wallet: string;
  plan: string;
  connectedAt: string;
  authorized: boolean;
  connectionId?: string;
}

export const registerWorker = ({
  workerName,
  wallet,
  plan,
  connectedAt,
  authorized,
  connectionId,
}: RegisterWorkerParams): WorkerRecord => {
  const record: WorkerRecord = {
    workerName,
    wallet: normalizeWallet(wallet),
    plan,
    connectedAt,
    authorized,
    connectionId,
  };

  workers.set(workerName, record);

  return record;
};

export const removeWorker = (workerName: string): void => {
  workers.delete(workerName);
};

export const removeWorkersByConnection = (connectionId: string): void => {
  for (const [workerName, worker] of workers.entries()) {
    if (worker.connectionId === connectionId) {
      workers.delete(workerName);
    }
  }
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
