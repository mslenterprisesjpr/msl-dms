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
