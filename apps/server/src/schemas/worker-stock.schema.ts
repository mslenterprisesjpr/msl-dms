import { z } from "zod";

// Schema for worker ID parameter
export const getWorkerStockParamsSchema = z.object({
	workerId: z.string().min(1, "Worker ID is required"),
});

// Schema for worker and product ID parameters
export const getWorkerProductStockParamsSchema = z.object({
	workerId: z.string().min(1, "Worker ID is required"),
	productId: z.string().min(1, "Product ID is required"),
});

// Schema for day-end closing settlement
export const closeDaySettlementBodySchema = z.object({
	workerId: z.string().min(1, "Worker ID is required"),
	cashReceived: z.number().min(0).default(0),
	returnAllStockToWarehouse: z.boolean().default(false),
	note: z.string().optional(),
});
