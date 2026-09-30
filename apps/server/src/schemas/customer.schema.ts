import { z } from "zod";

// Schema for creating a customer
export const createCustomerBodySchema = z.object({
	name: z.string().min(1, "Name is required"),
	phone: z.string().optional(),
	address: z.string().optional(),
	isActive: z.boolean().default(true),
});

// Schema for updating a customer
export const updateCustomerBodySchema = createCustomerBodySchema.partial();

// Schema for customer ID parameter
export const getCustomerParamsSchema = z.object({
	id: z.string().min(1, "Customer ID is required"),
});

// Schema for query parameters
export const getCustomersQuerySchema = z.object({
	search: z.string().optional(),
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().default(10),
	isActive: z.coerce.boolean().optional(),
});
