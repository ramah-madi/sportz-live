import { z } from "zod";

/**
 * Schema for validating the query parameters of a list commentaries request.
 */
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * Schema for validating the request body when creating a commentary entry.
 */
export const createCommentarySchema = z.object({
  minutes: z.number().int().nonnegative(),
  sequence: z.number().int(),
  period: z.string().trim().min(1, "Period is required"),
  eventType: z.string().trim().min(1, "Event type is required"),
  actor: z.string().trim().optional(),
  team: z.string().trim().optional(),
  message: z.string().trim().min(1, "Message is required"),
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});
