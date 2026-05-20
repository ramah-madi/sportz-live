import { WebSocket, WebSocketServer } from "ws";
import { Server as HttpServer, IncomingMessage } from "http";
import { MatchEntity } from "../routes/matches.js";
import { appEvents } from "../events.js";
import { wspArcjet } from "../arcjet.js";
import { Socket } from "net";

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
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024, // 1 mb, Its a securety measure against memory abuse or flooding
  });

  server.on("upgrade", async (req: IncomingMessage, socket: Socket, head: Buffer) => {
    // req.url might contain query parameters, so we parse it to just get the pathname
    const baseURL = `http://${req.headers.host || "localhost"}`;
    const { pathname } = new URL(req.url || "", baseURL);

    if (pathname !== "/ws") {
      return; // Let other upgrade listeners handle it
    }

    if (wspArcjet) {
      try {
        const decision = await wspArcjet.protect(req);
        if (decision.isDenied()) {
          const status = decision.reason.isRateLimit() ? "429 Too Many Requests" : "403 Forbidden";
          socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
          socket.destroy();
          return;
        }
      } catch (error) {
        console.error("WS upgrade error:", error);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket: AliveWebSocket, req: IncomingMessage) => {
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
