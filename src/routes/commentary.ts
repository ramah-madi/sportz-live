import { Router, Request, Response } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { matchIdParamSchema } from "../validation/matches.js";
import {
    createCommentarySchema,
    listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { ErrorResponse } from "../utils/responses.js";
import { appEvents } from "../events.js";
import { desc, eq } from "drizzle-orm";

// { mergeParams: true } is required to access the :id parameter from the parent route matches/:id/commentary
export const commentaryRouter = Router({ mergeParams: true });

export type CommentaryEntity = typeof commentary.$inferSelect;
type CreateCommentaryResponse = { data: CommentaryEntity } | ErrorResponse;
type GetCommentariesResponse = { data: CommentaryEntity[] } | ErrorResponse;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

commentaryRouter.get(
    "/",
    async (req: Request, res: Response<GetCommentariesResponse>) => {
        // Validate route params
        const paramsParsed = matchIdParamSchema.safeParse(req.params);
        if (!paramsParsed.success) {
            return res.status(400).json({
                error: "Invalid match ID in route parameter.",
                details: paramsParsed.error.issues,
            });
        }

        // Validate query params
        const queryParsed = listCommentaryQuerySchema.safeParse(req.query);
        if (!queryParsed.success) {
            return res.status(400).json({
                error: "Invalid query parameters.",
                details: queryParsed.error.issues,
            });
        }

        const matchId = paramsParsed.data.id;
        const limit = Math.min(queryParsed.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

        try {
            // Fetch data from "commentary" table ordered by "createdAt" in descending order with a limit
            const results = await db
                .select()
                .from(commentary)
                .where(eq(commentary.matchId, matchId))
                .limit(limit)
                .orderBy(desc(commentary.createdAt));

            return res.status(200).json({ data: results });
        } catch (error) {
            return res.status(500).json({
                error: "Failed to retrieve commentary entries.",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    }
);

commentaryRouter.post(
    "/",
    async (req: Request, res: Response<CreateCommentaryResponse>) => {
        // Validate route parameter (matchId)
        const paramsParsed = matchIdParamSchema.safeParse(req.params);
        if (!paramsParsed.success) {
            return res.status(400).json({
                error: "Invalid match ID in route parameter.",
                details: paramsParsed.error.issues,
            });
        }

        // Validate request body
        const bodyParsed = createCommentarySchema.safeParse(req.body);
        if (!bodyParsed.success) {
            return res.status(400).json({
                error: "Invalid request payload.",
                details: bodyParsed.error.issues,
            });
        }

        const matchId = paramsParsed.data.id;

        try {
            // Insert commentary into database
            const { minutes, ...rest } = bodyParsed.data;
            const [inserted] = await db
                .insert(commentary)
                .values({
                    matchId,
                    minute: minutes,
                    ...rest,
                })
                .returning();

            // Emit event for real-time subscribers (e.g. WebSockets)
            try {
                appEvents.emit("commentary_created", inserted);
            } catch (emitError) {
                console.error("Failed to emit commentary_created:", emitError);
            }

            return res.status(201).json({ data: inserted });
        } catch (error: any) {
            // Gracefully handle foreign key constraint violation if matching match does not exist
            if (error?.code === "23503") {
                return res.status(404).json({
                    error: `Match with ID ${matchId} does not exist.`,
                });
            }

            return res.status(500).json({
                error: "Failed to create commentary entry.",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    }
);