import { z } from "zod";

// Schema for creating a product
export const createProductBodySchema = z.object({
	name: z.string().min(1, "Name is required"),
	sku: z.string().min(1, "SKU is required"),
	category: z.string().optional(),
	packSize: z.string().min(1, "Pack size is required"),
	unit: z.enum(["BOTTLE", "PIECE", "KG", "LITER", "PACKET"]).default("BOTTLE"),
	unitsPerCase: z.number().int().min(1, "Units per case must be at least 1"),
	purchaseRate: z.number().min(0, "Purchase rate must be positive"),
	sellingRate: z.number().min(0, "Selling rate must be positive"),
	minimumStock: z.number().int().min(0).default(0),
	gstRate: z.number().min(0).max(100).default(0),
	image: z.string().url().optional(),
	isActive: z.boolean().default(true),
});

// Schema for updating a product
export const updateProductBodySchema = createProductBodySchema.partial();

// Schema for product ID parameter
export const getProductParamsSchema = z.object({
	id: z.string().min(1, "Product ID is required"),
});

// Schema for query parameters
export const getProductsQuerySchema = z.object({
	category: z.string().optional(),
	search: z.string().optional(),
	sort: z.enum(["name", "price_asc", "price_desc", "stock"]).optional(),
	minPrice: z.coerce.number().positive().optional(),
	maxPrice: z.coerce.number().positive().optional(),
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().default(10),
	isActive: z.coerce.boolean().optional(),
});
