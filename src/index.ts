import express, { Request, Response } from "express";

const app = express();
const port = 8000;

app.use(express.json());

app.get("/", (req: Request, res: Response): void => {
  res.send("Hello from Express server");
});

app.listen(port, (): void => {
  console.log(`Listening on port http://localhost:${port}`);
});
