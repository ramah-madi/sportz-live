import express, { Request, Response } from "express";
import matcheRouter from "./routes/matches.js";

const app = express();
const port = 8000;

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

app.listen(port, (): void => {
  console.log(`Listening on port http://localhost:${port}`);
});
