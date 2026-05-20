import express, { Request, Response } from "express";
import http from "http";
import matcheRouter from "./routes/matches.js";
import { attachWebSocketServer } from "./ws/server.js";

const parsedPort = Number(process.env.PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8000;
const HOST = process.env.HOST ?? "0.0.0.0";

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get("/", (req: Request, res: Response): void => {
  res.send("Hello from Express server");
});

const apiRouter = express.Router();

// Mount all your individual route files on the apiRouter
apiRouter.use("/matches", matcheRouter);
// apiRouter.use("/users", usersRouter);

// Finally, mount the apiRouter on the app with the desired global prefix
app.use("/api/v1", apiRouter);

attachWebSocketServer(server);

server.listen(PORT, HOST, (): void => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(
    `WebSocket server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
