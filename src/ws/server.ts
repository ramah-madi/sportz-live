import { WebSocket, WebSocketServer } from "ws";
import { Server as HttpServer, IncomingMessage } from "http";
import { MatchEntity } from "../routes/matches.js";
import { CommentaryEntity } from "../routes/commentary.js";
import { appEvents } from "../events.js";
import { wspArcjet } from "../arcjet.js";
import { Socket } from "net";

interface AliveWebSocket extends WebSocket {
  isAlive: boolean;
  subscriptions: Set<string>;
}

const matchSubscriptions = new Map();

function subscribe(matchId: string, socket: AliveWebSocket) {
  const key = matchId.toString();
  if (!matchSubscriptions.has(key)) {
    matchSubscriptions.set(key, new Set());
  }

  matchSubscriptions.get(key).add(socket);
}

function unsubscribe(matchId: string, socket: AliveWebSocket) {
  const key = matchId.toString();
  const subscribers = matchSubscriptions.get(key);

  if (!subscribers) {
    return;
  }

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscriptions.delete(key);
  }
}

function cleanupSubscriptions(socket: AliveWebSocket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket: WebSocket, payload: object) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss: WebSocketServer, payload: object) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(JSON.stringify(payload));
  }
}

function handleMessage(socket: AliveWebSocket, data: object) {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
    subscribe(message.matchId.toString(), socket);
    socket.subscriptions.add(message.matchId.toString());
    sendJson(socket, { type: "subscribed", matchId: message.matchId });
    return;
  }

  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unsubscribe(message.matchId.toString(), socket);
    socket.subscriptions.delete(message.matchId.toString());
    sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
    return;
  }
}

function broadcastToMatch(matchId: string, payload: object) {
  const subscribers = matchSubscriptions.get(matchId);

  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const message = JSON.stringify(payload);

  for (const subscriber of subscribers) {
    if (subscriber.readyState !== WebSocket.OPEN) {
      continue;
    }

    subscriber.send(message);
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

    socket.subscriptions = new Set();

    sendJson(socket, { type: "welcome" });

    socket.on("message", (data) => handleMessage(socket, data));

    socket.on("close", () => {
      cleanupSubscriptions(socket);
    });

    socket.on("error", console.error);

    socket.on("error", () => {
      socket.terminate();
    });

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
    broadcastToAll(wss, {
      type: "match_created",
      data: match,
    });
  }

  function broadcastCommentary(comment: CommentaryEntity) {
    broadcastToMatch(comment.matchId.toString(), {
      type: "commentary_created",
      data: comment,
    });
  }

  appEvents.on("match_created", broadcastMatchCreated);
  appEvents.on("commentary_created", broadcastCommentary);
}
