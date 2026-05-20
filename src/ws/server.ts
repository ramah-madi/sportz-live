import { WebSocket, WebSocketServer } from "ws";
import { Server as HttpServer } from "http";
import { MatchEntity } from "../routes/matches.js";
import { appEvents } from "../events.js";

interface AliveWebSocket extends WebSocket {
  isAlive: boolean;
}

function sendJson(socket: WebSocket, payload: object) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: object) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024, // 1 mb, Its a securety measure against memory abuse or flooding
  });

  wss.on("connection", (socket: AliveWebSocket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((socket) => {
      const client = socket as AliveWebSocket;
      if (!client.isAlive) {
        client.terminate();
        return;
      }

      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  function broadcastMatchCreated(match: MatchEntity) {
    broadcast(wss, {
      type: "match_created",
      data: match,
    });
  }

  appEvents.on("match_created", broadcastMatchCreated);
}
