import net from "node:net";

import { randomUUID } from "node:crypto";

import { config, DEFAULT_WORKER_LIMIT, WORKER_LIMITS } from "./config";
import { verifySessionToken } from "./services/token";
import {
  countActiveWorkersByWallet,
  getWorkersByWallet,
  listWorkers,
  registerWorker,
  removeWorkersByConnection,
} from "./services/workerRegistry";
import { JsonRpcRequest, JsonRpcResponse, MiningAuthorizeParams } from "./types";

const respond = (socket: net.Socket, response: JsonRpcResponse): void => {
  socket.write(`${JSON.stringify(response)}\n`);
};

const isJsonRpcRequest = (value: unknown): value is JsonRpcRequest => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<JsonRpcRequest>;

  return (
    "method" in candidate &&
    typeof candidate.method === "string" &&
    Array.isArray(candidate.params)
  );
};

const handleSubscribe = (socket: net.Socket, request: JsonRpcRequest): void => {
  console.log(`mining.subscribe received id=${String(request.id)}`);

  respond(socket, {
    id: request.id,
    result: [
      [
        ["mining.set_difficulty", "1"],
        ["mining.notify", "1"],
      ],
      "prototype-session",
      4,
    ],
    error: null,
  });
};

const handleAuthorize = async (
  socket: net.Socket,
  request: JsonRpcRequest,
  connectionId: string,
  authorizedWorkers: Set<string>,
): Promise<void> => {
  const params = request.params as MiningAuthorizeParams;
  const [workerName, sessionToken] = params;

  if (
    !Array.isArray(params) ||
    typeof workerName !== "string" ||
    typeof sessionToken !== "string"
  ) {
    respond(socket, {
      id: request.id,
      result: false,
      error: "Invalid authorize params",
    });
    return;
  }

  const session = await verifySessionToken(sessionToken);

  if (!session) {
    console.warn("mining.authorize rejected due to invalid token");
    respond(socket, {
      id: request.id,
      result: false,
      error: "Invalid, expired, or revoked session token",
    });
    return;
  }

  const wallet = session.wallet.trim().toLowerCase();
  const tier = session.plan || "prototype";
  const limit = WORKER_LIMITS[tier] || DEFAULT_WORKER_LIMIT;
  const existingWorkers = getWorkersByWallet(wallet);
  const existingWorker = existingWorkers.find(
    (worker) => worker.workerName === workerName,
  );
  const currentCount = countActiveWorkersByWallet(wallet);

  if (!existingWorker && currentCount >= limit) {
    console.warn(
      `mining.authorize rejected due to worker limit wallet=${wallet} tier=${tier} currentCount=${currentCount} limit=${limit} workerName=${workerName}`,
    );
    respond(socket, {
      id: request.id,
      result: false,
      error: "Worker limit exceeded for your membership tier",
    });
    return;
  }

  const worker = await registerWorker({
    workerName,
    wallet,
    plan: tier,
    connectionId,
    authorized: true,
    connectedAt: new Date().toISOString(),
  });
  authorizedWorkers.add(worker.workerName);

  console.log(
    `mining.authorize accepted worker=${worker.workerName} wallet=${worker.wallet} tier=${worker.plan} currentCount=${existingWorker ? currentCount : currentCount + 1} limit=${limit}`,
  );

  respond(socket, {
    id: request.id,
    result: true,
    error: null,
  });
};

const cleanupConnectionWorkers = async (
  connectionId: string,
  remote: string,
): Promise<void> => {
  const registeredWorkers: string[] = [];

  for (const worker of listWorkers()) {
    if (worker.connectionId === connectionId) {
      registeredWorkers.push(worker.workerName);
    }
  }

  await removeWorkersByConnection(connectionId);

  if (registeredWorkers.length > 0) {
    console.log(
      `worker disconnected and slot released connectionId=${connectionId} remote=${remote} workers=${registeredWorkers.join(",")}`,
    );
  }
};

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "unknown"}`;
  const connectionId = randomUUID();
  const authorizedWorkers = new Set<string>();
  let cleanedUp = false;

  const releaseConnectionWorkers = async (): Promise<void> => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    await cleanupConnectionWorkers(connectionId, remote);

    if (authorizedWorkers.size > 0) {
      authorizedWorkers.clear();
    }
  };

  console.log(`connection opened remote=${remote} connectionId=${connectionId}`);

  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");

    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const rawMessage = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (rawMessage.length > 0) {
        try {
          const parsed = JSON.parse(rawMessage) as unknown;

          if (!isJsonRpcRequest(parsed)) {
            respond(socket, {
              id: null,
              result: null,
              error: "Invalid JSON-RPC request",
            });
          } else if (parsed.method === "mining.subscribe") {
            handleSubscribe(socket, parsed);
          } else if (parsed.method === "mining.authorize") {
            void handleAuthorize(socket, parsed, connectionId, authorizedWorkers);
          } else {
            respond(socket, {
              id: parsed.id ?? null,
              result: null,
              error: "Unsupported method",
            });
          }
        } catch {
          respond(socket, {
            id: null,
            result: null,
            error: "Invalid JSON",
          });
        }
      }

      newlineIndex = buffer.indexOf("\n");
    }
  });

  socket.on("end", async () => {
    await releaseConnectionWorkers();
    console.log(`Client ended from ${remote} connectionId=${connectionId}`);
  });

  socket.on("close", async () => {
    await releaseConnectionWorkers();
    console.log(`Client disconnected from ${remote} connectionId=${connectionId}`);
  });

  socket.on("error", async (error) => {
    await releaseConnectionWorkers();
    console.error(`Socket error from ${remote}:`, error.message);
  });
});

server.on("error", (error) => {
  console.error("Stratum mock server error:", error.message);
});

server.listen(config.STRATUM_PORT, config.STRATUM_HOST, () => {
  console.log(
    `Stratum mock server listening on ${config.STRATUM_HOST}:${config.STRATUM_PORT}`,
  );
  console.log(
    "JWT validation now checks Redis-backed revocations before accepting a token.",
  );
});
