import { z } from "zod";

// Schema for date range queries
export const dateRangeQuerySchema = z.object({
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
	period: z.enum(["today", "week", "month", "year", "all"]).default("month"),
});

// Schema for worker ID parameter
export const workerReportParamsSchema = z.object({
	workerId: z.string().min(1, "Worker ID is required"),
});
