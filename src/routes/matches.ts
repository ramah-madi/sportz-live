import { Router, Request, Response } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { desc } from "drizzle-orm";
import { ErrorResponse } from "../utils/responses.js";

type Match = typeof matches.$inferSelect;
type GetMatchesResponse = { data: Match[] } | ErrorResponse;
type CreateMatchResponse = { data: Match } | ErrorResponse;

const matcheRouter = Router();
const MAX_LIMIT = 100;

matcheRouter.get(
  "/",
  async (req: Request, res: Response<GetMatchesResponse>) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query.",
        details: JSON.stringify(parsed.error),
      });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

    try {
      const result = await db
        .select()
        .from(matches)
        .limit(limit)
        .orderBy(desc(matches.createdAt));
      return res.status(200).json({ data: result });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to retrieve matches.",
        details: JSON.stringify(error),
      });
    }
  },
);

matcheRouter.post(
  "/",
  async (req: Request, res: Response<CreateMatchResponse>) => {
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid payload.",
        details: JSON.stringify(parsed.error),
      });
    }

    const {
      data: { startTime, endTime, homeScore, awayScore },
    } = parsed;

    try {
      const [event] = await db
        .insert(matches)
        .values({
          ...parsed.data,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          homeScore: homeScore ?? 0,
          awayScore: awayScore ?? 0,
        })
        .returning();

      return res.status(201).json({ data: event });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to create match.",
        details: JSON.stringify(error),
      });
    }
  },
);

export default matcheRouter;
