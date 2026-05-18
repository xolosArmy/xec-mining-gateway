import net from "node:net";

import { config } from "./config";
import { JsonRpcResponse } from "./types";

if (!config.SESSION_TOKEN) {
  console.error(
    "Missing SESSION_TOKEN. Generate one from the Membership Portal UI or backend auth flow first.",
  );
  process.exit(1);
}

const socket = net.createConnection(
  {
    host: config.STRATUM_HOST,
    port: config.STRATUM_PORT,
  },
  () => {
    console.log(
      `Connected to stratum mock at ${config.STRATUM_HOST}:${config.STRATUM_PORT}`,
    );

    const subscribeRequest = {
      id: 1,
      method: "mining.subscribe",
      params: [],
    };

    socket.write(`${JSON.stringify(subscribeRequest)}\n`);
  },
);

let buffer = "";
let authorizeSent = false;

socket.on("data", (chunk) => {
  buffer += chunk.toString("utf8");

  let newlineIndex = buffer.indexOf("\n");

  while (newlineIndex >= 0) {
    const rawMessage = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);

    if (rawMessage.length > 0) {
      console.log(`Server response: ${rawMessage}`);

      try {
        const response = JSON.parse(rawMessage) as JsonRpcResponse;

        if (response.id === 1 && !authorizeSent) {
          authorizeSent = true;

          const authorizeRequest = {
            id: 2,
            method: "mining.authorize",
            params: [config.WORKER_NAME, config.SESSION_TOKEN],
          };

          socket.write(`${JSON.stringify(authorizeRequest)}\n`);
        }
      } catch {
        console.error("Received non-JSON response from server.");
      }
    }

    newlineIndex = buffer.indexOf("\n");
  }
});

socket.on("close", () => {
  console.log("Connection closed.");
});

socket.on("error", (error) => {
  console.error("Client socket error:", error.message);
});
