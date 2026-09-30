import { z } from "zod";

// Schema for order items
const orderItemSchema = z
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

// Schema for creating an order
export const createOrderBodySchema = z.object({
	customerId: z.string().min(1, "Customer ID is required"),
	expectedDeliveryDate: z.string().datetime().optional(),
	deliveryType: z.enum(["IMMEDIATE", "LATER"]).default("IMMEDIATE"),
	items: z.array(orderItemSchema).min(1, "At least one item is required"),
	discount: z.number().min(0).default(0),
	note: z.string().optional(),
});

// Schema for updating an order
export const updateOrderBodySchema = z.object({
	customerId: z.string().min(1).optional(),
	expectedDeliveryDate: z.string().datetime().optional(),
	deliveryType: z.enum(["IMMEDIATE", "LATER"]).optional(),
	discount: z.number().min(0).optional(),
	note: z.string().optional(),
});

// Schema for updating order status
export const updateOrderStatusBodySchema = z.object({
	status: z.enum(["PENDING", "PARTIAL", "DELIVERED", "CANCELLED"]),
	note: z.string().optional(),
});

// Schema for order ID parameter
export const getOrderParamsSchema = z.object({
	id: z.string().min(1, "Order ID is required"),
});

// Schema for worker ID parameter
export const getWorkerOrdersParamsSchema = z.object({
	workerId: z.string().min(1, "Worker ID is required"),
});

// Schema for query parameters
export const getOrdersQuerySchema = z.object({
	status: z.enum(["PENDING", "PARTIAL", "DELIVERED", "CANCELLED"]).optional(),
	workerId: z.string().optional(),
	customerId: z.string().optional(),
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().default(10),
});

// Schema for delivering an order
export const deliverOrderBodySchema = z.object({
	items: z
		.array(
			z
				.object({
					orderItemId: z.string().min(1, "Order item ID is required"),
					deliveredCases: z
						.number()
						.int()
						.min(0, "Delivered cases must be non-negative")
						.default(0),
					deliveredUnits: z
						.number()
						.int()
						.min(0, "Delivered units must be non-negative")
						.default(0),
				})
				.refine((data) => data.deliveredCases > 0 || data.deliveredUnits > 0, {
					message:
						"At least one of delivered cases or units must be greater than 0",
					path: ["deliveredCases"],
				}),
		)
		.min(1, "At least one item must be delivered"),
	paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
	paidAmount: z.number().min(0).default(0),
	note: z.string().optional(),
});
