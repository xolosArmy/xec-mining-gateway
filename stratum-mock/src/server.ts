import net from "node:net";

import { randomUUID } from "node:crypto";

import { config, DEFAULT_WORKER_LIMIT, WORKER_LIMITS } from "./config";
import {
  ProxyBridge,
  connectUpstream,
  rewriteAuthorizeForUpstream,
  startBidirectionalProxy,
} from "./services/proxy";
import { verifySessionToken } from "./services/token";
import {
  countActiveWorkersByWallet,
  getWorkersByWallet,
  listWorkers,
  registerWorker,
  removeWorker,
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

const validateAuthorizeParams = (
  request: JsonRpcRequest,
): MiningAuthorizeParams | null => {
  const params = request.params as MiningAuthorizeParams;
  const [workerName, sessionToken] = params;

  if (
    !Array.isArray(params) ||
    typeof workerName !== "string" ||
    typeof sessionToken !== "string"
  ) {
    return null;
  }

  return [workerName, sessionToken];
};

const registerAuthorizedWorker = async (
  request: JsonRpcRequest,
  connectionId: string,
  registeredWorkers: Set<string>,
): Promise<
  | {
      currentCount: number;
      limit: number;
      tier: string;
      wallet: string;
      workerName: string;
    }
  | {
      error: "invalid-params" | "invalid-token" | "worker-limit";
    }
> => {
  const params = validateAuthorizeParams(request);

  if (!params) {
    return { error: "invalid-params" };
  }

  const [workerName, sessionToken] = params;
  const session = await verifySessionToken(sessionToken);

  if (!session) {
    return { error: "invalid-token" };
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
    return { error: "worker-limit" };
  }

  const worker = await registerWorker({
    workerName,
    wallet,
    plan: tier,
    connectionId,
    authorized: true,
    connectedAt: new Date().toISOString(),
  });
  registeredWorkers.add(worker.workerName);

  return {
    currentCount: existingWorker ? currentCount : currentCount + 1,
    limit,
    tier,
    wallet,
    workerName: worker.workerName,
  };
};

const handleMockAuthorize = async (
  socket: net.Socket,
  request: JsonRpcRequest,
  connectionId: string,
  registeredWorkers: Set<string>,
): Promise<void> => {
  const result = await registerAuthorizedWorker(
    request,
    connectionId,
    registeredWorkers,
  );

  if ("error" in result) {
    if (result.error === "invalid-params") {
      respond(socket, {
        id: request.id,
        result: false,
        error: "Invalid authorize params",
      });
      return;
    }

    if (result.error === "invalid-token") {
      console.warn("local authorization failure reason=invalid-token");
      respond(socket, {
        id: request.id,
        result: false,
        error: "Invalid, expired, or revoked session token",
      });
      return;
    }

    console.warn("local authorization failure reason=worker-limit");
    respond(socket, {
      id: request.id,
      result: false,
      error: "Worker limit exceeded for your membership tier",
    });
    return;
  }

  console.log(
    `mining.authorize accepted worker=${result.workerName} wallet=${result.wallet} tier=${result.tier} currentCount=${result.currentCount} limit=${result.limit}`,
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
      `cleanup workers connectionId=${connectionId} remote=${remote} workers=${registeredWorkers.join(",")}`,
    );
  }
};

const createMockConnectionHandler =
  () =>
  (socket: net.Socket): void => {
    const remote = `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "unknown"}`;
    const connectionId = randomUUID();
    const registeredWorkers = new Set<string>();
    let cleanedUp = false;
    let buffer = "";

    const releaseConnectionWorkers = async (): Promise<void> => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      await cleanupConnectionWorkers(connectionId, remote);
      registeredWorkers.clear();
    };

    console.log(
      `client connected mode=mock remote=${remote} connectionId=${connectionId}`,
    );

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
              void handleMockAuthorize(
                socket,
                parsed,
                connectionId,
                registeredWorkers,
              );
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
      console.log(`client ended mode=mock remote=${remote} connectionId=${connectionId}`);
    });

    socket.on("close", async () => {
      await releaseConnectionWorkers();
      console.log(
        `client disconnected mode=mock remote=${remote} connectionId=${connectionId}`,
      );
    });

    socket.on("error", async (error) => {
      await releaseConnectionWorkers();
      console.error(
        `client socket error mode=mock remote=${remote} connectionId=${connectionId}: ${error.message}`,
      );
    });
  };

const createProxyConnectionHandler =
  () =>
  (socket: net.Socket): void => {
    const remote = `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "unknown"}`;
    const connectionId = randomUUID();
    const registeredWorkers = new Set<string>();
    let cleanedUp = false;
    let buffer = "";
    let localAuthorized = false;
    let upstreamConnected = false;
    let bridge: ProxyBridge | null = null;
    let upstreamSocket: net.Socket | null = null;
    let upstreamConnectPromise: Promise<net.Socket> | null = null;
    let disconnectHandled = false;

    const clearRegisteredWorkers = async (): Promise<void> => {
      for (const workerName of Array.from(registeredWorkers)) {
        await removeWorker(workerName);
        registeredWorkers.delete(workerName);
      }

      localAuthorized = false;
    };

    const releaseConnectionWorkers = async (): Promise<void> => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      await cleanupConnectionWorkers(connectionId, remote);
      registeredWorkers.clear();
    };

    const handleUpstreamDisconnect = async (reason: string): Promise<void> => {
      if (disconnectHandled) {
        return;
      }

      disconnectHandled = true;
      upstreamConnected = false;
      bridge = null;
      upstreamConnectPromise = null;

      console.warn(
        `upstream disconnected reason=${reason} remote=${remote} connectionId=${connectionId}`,
      );

      if (!socket.destroyed) {
        socket.end();
      }

      await releaseConnectionWorkers();
    };

    const ensureUpstreamConnection = async (): Promise<net.Socket> => {
      if (upstreamSocket && upstreamConnected && !upstreamSocket.destroyed) {
        return upstreamSocket;
      }

      if (!upstreamConnectPromise) {
        upstreamConnectPromise = connectUpstream()
          .then((connectedSocket) => {
            upstreamSocket = connectedSocket;
            upstreamConnected = true;
            disconnectHandled = false;

            console.log(
              `upstream connected host=${config.UPSTREAM_STRATUM_HOST} port=${config.UPSTREAM_STRATUM_PORT} remote=${remote} connectionId=${connectionId}`,
            );

            bridge = startBidirectionalProxy(
              socket,
              connectedSocket,
              async (rawLine) => {
                console.log(
                  `upstream response remote=${remote} connectionId=${connectionId} payload=${rawLine}`,
                );

                try {
                  const parsed = JSON.parse(rawLine) as Partial<JsonRpcResponse>;

                  if (parsed.result === false || typeof parsed.error === "string") {
                    await clearRegisteredWorkers();
                  }
                } catch {
                  console.warn(
                    `upstream response parse skipped remote=${remote} connectionId=${connectionId}`,
                  );
                }
              },
            );

            connectedSocket.on("close", () => {
              void handleUpstreamDisconnect("close");
            });

            connectedSocket.on("end", () => {
              void handleUpstreamDisconnect("end");
            });

            connectedSocket.on("error", (error) => {
              console.error(
                `upstream socket error remote=${remote} connectionId=${connectionId}: ${error.message}`,
              );
              void handleUpstreamDisconnect(`error:${error.message}`);
            });

            return connectedSocket;
          })
          .catch((error: Error) => {
            upstreamConnectPromise = null;
            console.error(
              `upstream connection failed remote=${remote} connectionId=${connectionId}: ${error.message}`,
            );
            throw error;
          });
      }

      return upstreamConnectPromise;
    };

    console.log(
      `client connected mode=proxy remote=${remote} connectionId=${connectionId}`,
    );

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      let newlineIndex = buffer.indexOf("\n");

      while (newlineIndex >= 0) {
        const rawMessage = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (rawMessage.length > 0) {
          void (async () => {
            try {
              const parsed = JSON.parse(rawMessage) as unknown;

              if (!isJsonRpcRequest(parsed)) {
                respond(socket, {
                  id: null,
                  result: null,
                  error: "Invalid JSON-RPC request",
                });
                return;
              }

              if (parsed.method === "mining.subscribe") {
                const upstream = await ensureUpstreamConnection();

                console.log(
                  `forwarding subscribe upstream remote=${remote} connectionId=${connectionId}`,
                );
                upstream.write(`${rawMessage}\n`);
                return;
              }

              if (parsed.method === "mining.authorize") {
                const authorizeResult = await registerAuthorizedWorker(
                  parsed,
                  connectionId,
                  registeredWorkers,
                );

                if ("error" in authorizeResult) {
                  if (authorizeResult.error === "invalid-params") {
                    respond(socket, {
                      id: parsed.id,
                      result: false,
                      error: "Invalid authorize params",
                    });
                    return;
                  }

                  if (authorizeResult.error === "invalid-token") {
                    console.warn(
                      `local authorization failure reason=invalid-token remote=${remote} connectionId=${connectionId}`,
                    );
                    respond(socket, {
                      id: parsed.id,
                      result: false,
                      error: "Invalid, expired, or revoked session token",
                    });
                    return;
                  }

                  console.warn(
                    `local authorization failure reason=worker-limit remote=${remote} connectionId=${connectionId}`,
                  );
                  respond(socket, {
                    id: parsed.id,
                    result: false,
                    error: "Worker limit exceeded for your membership tier",
                  });
                  return;
                }

                localAuthorized = true;
                console.log(
                  `local authorization success worker=${authorizeResult.workerName} wallet=${authorizeResult.wallet} tier=${authorizeResult.tier} currentCount=${authorizeResult.currentCount} limit=${authorizeResult.limit} remote=${remote} connectionId=${connectionId}`,
                );

                await ensureUpstreamConnection();
                const upstreamAuthorizeRequest = rewriteAuthorizeForUpstream(parsed);
                bridge?.forwardClientLine(JSON.stringify(upstreamAuthorizeRequest));

                console.log(
                  `proxy started remote=${remote} connectionId=${connectionId} strategy=${config.PROXY_AUTH_STRATEGY}`,
                );
                return;
              }

              if (!localAuthorized) {
                respond(socket, {
                  id: parsed.id ?? null,
                  result: null,
                  error: "Worker not authorized yet",
                });
                return;
              }

              await ensureUpstreamConnection();
              bridge?.forwardClientLine(rawMessage);
            } catch (error) {
              if (error instanceof SyntaxError) {
                respond(socket, {
                  id: null,
                  result: null,
                  error: "Invalid JSON",
                });
                return;
              }

              const message =
                error instanceof Error ? error.message : "unknown error";

              await clearRegisteredWorkers();

              console.error(
                `proxy request handling failed remote=${remote} connectionId=${connectionId}: ${message}`,
              );
              respond(socket, {
                id: null,
                result: null,
                error: "Upstream connection unavailable",
              });
            }
          })();
        }

        newlineIndex = buffer.indexOf("\n");
      }
    });

    socket.on("end", async () => {
      bridge?.close();
      await releaseConnectionWorkers();
      console.log(`client ended mode=proxy remote=${remote} connectionId=${connectionId}`);
    });

    socket.on("close", async () => {
      bridge?.close();
      await releaseConnectionWorkers();
      console.log(
        `client disconnected mode=proxy remote=${remote} connectionId=${connectionId}`,
      );
    });

    socket.on("error", async (error) => {
      bridge?.close();
      await releaseConnectionWorkers();
      console.error(
        `client socket error mode=proxy remote=${remote} connectionId=${connectionId}: ${error.message}`,
      );
    });
  };

if (config.STRATUM_MODE === "proxy" && !config.UPSTREAM_STRATUM_HOST) {
  console.error(
    "Proxy mode requires UPSTREAM_STRATUM_HOST. Set STRATUM_MODE=mock or configure the upstream pool host.",
  );
  process.exit(1);
}

const connectionHandler =
  config.STRATUM_MODE === "proxy"
    ? createProxyConnectionHandler()
    : createMockConnectionHandler();

const server = net.createServer(connectionHandler);

server.on("error", (error) => {
  console.error(`Stratum server error mode=${config.STRATUM_MODE}: ${error.message}`);
});

server.listen(config.STRATUM_PORT, config.STRATUM_HOST, () => {
  console.log(
    `Stratum server listening mode=${config.STRATUM_MODE} host=${config.STRATUM_HOST} port=${config.STRATUM_PORT}`,
  );

  if (config.STRATUM_MODE === "proxy") {
    console.log(
      `Proxy upstream configured host=${config.UPSTREAM_STRATUM_HOST} port=${config.UPSTREAM_STRATUM_PORT} strategy=${config.PROXY_AUTH_STRATEGY}`,
    );
  } else {
    console.log(
      "JWT validation now checks Redis-backed revocations before accepting a token.",
    );
  }
});
