import net from "node:net";

import { randomUUID } from "node:crypto";

import { config } from "./config";
import { JsonRpcRequest, JsonRpcResponse } from "./types";

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

const host = config.UPSTREAM_STRATUM_HOST || "127.0.0.1";
const port = config.UPSTREAM_STRATUM_PORT;

const server = net.createServer((socket) => {
  const connectionId = randomUUID();
  const remote = `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "unknown"}`;
  let buffer = "";

  console.log(
    `Upstream test server client connected remote=${remote} connectionId=${connectionId}`,
  );

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");

    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const rawMessage = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (rawMessage.length > 0) {
        console.log(`Upstream test server received: ${rawMessage}`);

        try {
          const parsed = JSON.parse(rawMessage) as unknown;

          if (!isJsonRpcRequest(parsed)) {
            respond(socket, {
              id: null,
              result: null,
              error: "Invalid JSON-RPC request",
            });
          } else if (parsed.method === "mining.subscribe") {
            respond(socket, {
              id: parsed.id,
              result: [
                [
                  ["mining.set_difficulty", "1"],
                  ["mining.notify", "1"],
                ],
                "upstream-test-session",
                4,
              ],
              error: null,
            });
          } else if (parsed.method === "mining.authorize") {
            respond(socket, {
              id: parsed.id,
              result: true,
              error: null,
            });
            socket.write(
              `${JSON.stringify({
                id: null,
                method: "mining.notify",
                params: ["test-job", "placeholder"],
              })}\n`,
            );
          } else {
            respond(socket, {
              id: parsed.id,
              result: true,
              error: null,
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

  socket.on("close", () => {
    console.log(
      `Upstream test server client disconnected remote=${remote} connectionId=${connectionId}`,
    );
  });

  socket.on("error", (error) => {
    console.error(
      `Upstream test server socket error remote=${remote} connectionId=${connectionId}: ${error.message}`,
    );
  });
});

server.on("error", (error) => {
  console.error(`Upstream test server error: ${error.message}`);
});

server.listen(port, host, () => {
  console.log(`Upstream test server listening on ${host}:${port}`);
});
