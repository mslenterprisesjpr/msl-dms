import { z } from "zod";

// Schema for purchasing stock (adding to warehouse)
export const purchaseStockBodySchema = z
	.object({
		productId: z.string().min(1, "Product ID is required"),
		cases: z.number().int().min(0, "Cases must be non-negative").default(0),
		units: z.number().int().min(0, "Units must be non-negative").default(0),
		quantity: z.number().min(0).optional(),
		unit: z.string().optional(),
		batchNo: z.string().optional(),
		mfgDate: z.string().optional(),
		expiryDate: z.string().optional(),
		purchaseRate: z.number().min(0).optional(),
		sellingRate: z.number().min(0).optional(),
		supplier: z.string().optional(),
		note: z.string().optional(),
	})
	.refine(
		(data) =>
			(data.cases || 0) > 0 ||
			(data.units || 0) > 0 ||
			(data.quantity || 0) > 0,
		{
			message: "Quantity must be greater than 0",
			path: ["units"],
		},
	);

// Schema for issuing stock to worker
export const issueStockBodySchema = z
	.object({
		productId: z.string().min(1, "Product ID is required"),
		workerId: z.string().min(1, "Worker ID is required"),
		cases: z.number().int().min(0, "Cases must be non-negative").default(0),
		units: z.number().int().min(0, "Units must be non-negative").default(0),
		note: z.string().optional(),
	})
	.refine(
		(data: { cases: number; units: number }) =>
			data.cases > 0 || data.units > 0,
		{
			message: "At least one of cases or units must be greater than 0",
			path: ["cases"],
		},
	);

// Schema for returning stock from worker
export const returnStockBodySchema = z
	.object({
		productId: z.string().min(1, "Product ID is required"),
		workerId: z.string().optional(),
		cases: z.number().int().min(0, "Cases must be non-negative").default(0),
		units: z.number().int().min(0, "Units must be non-negative").default(0),
		note: z.string().optional(),
	})
	.refine(
		(data: { cases: number; units: number }) =>
			data.cases > 0 || data.units > 0,
		{
			message: "At least one of cases or units must be greater than 0",
			path: ["cases"],
		},
	);

// Schema for manual stock adjustment
export const adjustStockBodySchema = z.object({
	productId: z.string().min(1, "Product ID is required"),
	quantity: z.number().int(), // Can be negative for decrements
	note: z.string().min(1, "Note is required for adjustments"),
});

// Schema for query parameters
export const getTransactionsQuerySchema = z.object({
	type: z
		.enum(["PURCHASE", "ISSUE", "SALE", "RETURN", "ADJUSTMENT"])
		.optional(),
	productId: z.string().optional(),
	workerId: z.string().optional(),
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().default(20),
});
