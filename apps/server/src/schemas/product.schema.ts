import { z } from "zod";

// Base schema without refinement
const productBaseSchema = z.object({
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
	cgst: z.number().min(0).max(50).optional(),
	sgst: z.number().min(0).max(50).optional(),
	image: z.string().url().optional().or(z.literal("")),
	isActive: z.boolean().default(true),
});

// Schema for creating a product (with refinement)
export const createProductBodySchema = productBaseSchema.refine(
	(data) => {
		// If CGST and SGST are provided, they should sum to gstRate
		if (data.cgst !== undefined && data.sgst !== undefined) {
			const sum = data.cgst + data.sgst;
			return Math.abs(sum - data.gstRate) < 0.01; // Allow small rounding difference
		}
		return true;
	},
	{
		message: "CGST + SGST must equal GST Rate",
		path: ["gstRate"],
	},
);

// Schema for updating a product (partial without refinement for now)
export const updateProductBodySchema = productBaseSchema.partial();

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
