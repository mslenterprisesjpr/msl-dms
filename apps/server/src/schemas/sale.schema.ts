import { z } from "zod";

// Schema for sale items
const saleItemSchema = z
	.object({
		productId: z.string().min(1, "Product ID is required"),
		cases: z.number().int().min(0, "Cases must be non-negative").default(0),
		units: z.number().int().min(0, "Units must be non-negative").default(0),
		price: z.number().min(0, "Price must be non-negative"),
	})
	.refine((data) => data.cases > 0 || data.units > 0, {
		message: "At least one of cases or units must be greater than 0",
		path: ["cases"],
	});

// Schema for creating a sale (direct sale without order)
export const createSaleBodySchema = z.object({
	customerId: z.string().min(1, "Customer ID is required"),
	items: z.array(saleItemSchema).min(1, "At least one item is required"),
	discount: z.number().min(0).default(0),
	paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
	paidAmount: z.number().min(0).default(0),
	note: z.string().optional(),
});

// Schema for updating a sale (ADMIN only)
export const updateSaleBodySchema = z.object({
	discount: z.number().min(0).optional(),
	note: z.string().optional(),
});

// Schema for sale ID parameter
export const getSaleParamsSchema = z.object({
	id: z.string().min(1, "Sale ID is required"),
});

// Schema for invoice number parameter
export const getSaleByInvoiceParamsSchema = z.object({
	invoiceNo: z.string().min(1, "Invoice number is required"),
});

// Schema for worker ID parameter
export const getWorkerSalesParamsSchema = z.object({
	workerId: z.string().min(1, "Worker ID is required"),
});

// Schema for query parameters
export const getSalesQuerySchema = z.object({
	paymentStatus: z.enum(["PAID", "PARTIAL", "PENDING"]).optional(),
	status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
	workerId: z.string().optional(),
	customerId: z.string().optional(),
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().default(10),
});
