import net from "node:net";

import { config } from "../config";
import { JsonRpcRequest } from "../types";

export interface ProxyBridge {
  close: () => void;
  forwardClientLine: (rawLine: string) => void;
}

const appendNewline = (rawLine: string): string =>
  rawLine.endsWith("\n") ? rawLine : `${rawLine}\n`;

export const connectUpstream = async (): Promise<net.Socket> =>
  new Promise((resolve, reject) => {
    if (!config.UPSTREAM_STRATUM_HOST) {
      reject(new Error("UPSTREAM_STRATUM_HOST is required in proxy mode"));
      return;
    }

    const socket = net.createConnection(
      {
        host: config.UPSTREAM_STRATUM_HOST,
        port: config.UPSTREAM_STRATUM_PORT,
      },
      () => resolve(socket),
    );

    socket.once("error", reject);
    socket.once("connect", () => {
      socket.removeListener("error", reject);
    });
  });

export const rewriteAuthorizeForUpstream = (
  request: JsonRpcRequest,
): JsonRpcRequest => {
  if (config.PROXY_AUTH_STRATEGY === "pass-through") {
    return request;
  }

  return {
    id: request.id,
    method: "mining.authorize",
    params: [
      config.UPSTREAM_STRATUM_USERNAME,
      config.UPSTREAM_STRATUM_PASSWORD,
    ],
  };
};

export const startBidirectionalProxy = (
  clientSocket: net.Socket,
  upstreamSocket: net.Socket,
  onUpstreamLine?: (rawLine: string) => void | Promise<void>,
): ProxyBridge => {
  let upstreamBuffer = "";

  upstreamSocket.on("data", (chunk) => {
    const rawChunk = chunk.toString("utf8");
    clientSocket.write(rawChunk);

    upstreamBuffer += rawChunk;
    let newlineIndex = upstreamBuffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const rawLine = upstreamBuffer.slice(0, newlineIndex).trim();
      upstreamBuffer = upstreamBuffer.slice(newlineIndex + 1);

      if (rawLine.length > 0) {
        void Promise.resolve(onUpstreamLine?.(rawLine)).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "unknown upstream callback error";
          console.error(`Proxy upstream line handler failed: ${message}`);
        });
      }

      newlineIndex = upstreamBuffer.indexOf("\n");
    }
  });

  const closeBoth = (): void => {
    if (!clientSocket.destroyed) {
      clientSocket.end();
    }

    if (!upstreamSocket.destroyed) {
      upstreamSocket.end();
    }
  };

  clientSocket.on("close", () => {
    if (!upstreamSocket.destroyed) {
      upstreamSocket.end();
    }
  });

  clientSocket.on("end", () => {
    if (!upstreamSocket.destroyed) {
      upstreamSocket.end();
    }
  });

  clientSocket.on("error", () => {
    if (!upstreamSocket.destroyed) {
      upstreamSocket.destroy();
    }
  });

  upstreamSocket.on("close", closeBoth);
  upstreamSocket.on("end", closeBoth);
  upstreamSocket.on("error", closeBoth);

  return {
    close: closeBoth,
    forwardClientLine: (rawLine: string) => {
      if (!upstreamSocket.destroyed) {
        upstreamSocket.write(appendNewline(rawLine));
      }
    },
  };
};
