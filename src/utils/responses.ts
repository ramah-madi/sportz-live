import { ZodIssue } from "zod";

export type ErrorResponse = {
  error: string;
  details?: string | ZodIssue[];
};
