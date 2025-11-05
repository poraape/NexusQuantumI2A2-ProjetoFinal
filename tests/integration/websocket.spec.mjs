import assert from "node:assert/strict";
import { WebSocket, WebSocketServer } from "ws";

/**
 * Este teste simula o handshake UI ↔ Gateway ↔ Planner utilizando certificados
 * mockados. A intenção é documentar o contrato esperado antes da implementação
 * real na Fase C.
 */

describe("canal websocket seguro", () => {
  it("estabelece handshake e troca intents", async () => {
    const messages = [];
    const wss = new WebSocketServer({ port: 19090 });

    wss.on("connection", (socket) => {
      socket.on("message", (message) => {
        const payload = JSON.parse(message.toString());
        messages.push(payload);
        socket.send(JSON.stringify({
          schemaVersion: "1.0.0",
          headers: { traceId: payload.headers.traceId, agentId: "planner.agent" },
          payload: { status: "accepted" }
        }));
      });
    });

    const ws = new WebSocket("ws://localhost:19090/ws/planner", {
      headers: {
        "x-session-token": "mock-token"
      }
    });

    const intentEnvelope = {
      schemaVersion: "1.0.0",
      headers: {
        traceId: "trace-mock-1234",
        agentId: "interface.agent",
        timestamp: new Date().toISOString(),
        sessionId: "session-1"
      },
      payload: {
        intentType: "upload.analyze",
        arguments: {
          files: [
            {
              uri: "https://storage/arquivo.xml",
              hash: "hash123"
            }
          ]
        }
      }
    };

    await new Promise((resolve, reject) => {
      ws.once("open", () => {
        ws.send(JSON.stringify(intentEnvelope));
      });
      ws.once("error", reject);
      ws.once("message", (raw) => {
        const response = JSON.parse(raw.toString());
        assert.equal(response.headers.agentId, "planner.agent");
        assert.equal(response.payload.status, "accepted");
        resolve();
      });
    });

    assert.equal(messages.length, 1);
    assert.equal(messages[0].payload.intentType, "upload.analyze");

    ws.close();
    wss.close();
  }).timeout(5000);
});
