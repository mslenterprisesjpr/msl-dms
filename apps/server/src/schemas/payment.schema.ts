import { z } from "zod";

// Schema for adding a payment
export const addPaymentBodySchema = z.object({
	saleId: z.string().min(1, "Sale ID is required"),
	amount: z.number().positive("Amount must be positive"),
	paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
	paymentDate: z.string().datetime().optional(),
	note: z.string().optional(),
});

// Schema for sale ID parameter
export const getPaymentsBySaleParamsSchema = z.object({
	saleId: z.string().min(1, "Sale ID is required"),
});

// Schema for query parameters
export const getPaymentsQuerySchema = z.object({
	saleId: z.string().optional(),
	paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).optional(),
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().default(20),
});
