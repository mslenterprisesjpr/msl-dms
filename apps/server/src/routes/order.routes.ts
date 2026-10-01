import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import {
	Customer,
	Order,
	OrderItem,
	Payment,
	Product,
	Sale,
	SaleItem,
	StockTransaction,
	WorkerStock,
} from "@msl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { organizationFilter, resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import { requireRole, UserRole } from "@/middleware/authorization.middleware";
import {
	createOrderBodySchema,
	deliverOrderBodySchema,
	getOrderParamsSchema,
	getOrdersQuerySchema,
	getWorkerOrdersParamsSchema,
	updateOrderBodySchema,
	updateOrderStatusBodySchema,
} from "@/schemas/order.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Helper function to generate order number
async function generateOrderNumber(orgId: string): Promise<string> {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");

	// Count orders for this org this month
	const startOfMonth = new Date(year, today.getMonth(), 1);
	const count = await Order.countDocuments({
		orgId,
		createdAt: { $gte: startOfMonth },
	});

	const orderNum = String(count + 1).padStart(4, "0");
	return `ORD-${year}${month}-${orderNum}`;
}

// Get all orders with filtering (ADMIN/WORKER)
app.get(
	"/",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("query", getOrdersQuerySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		const filter: any = { orgId: orgFilter };

		if (query.status) {
			filter.status = query.status;
		}

		if (query.customerId) {
			filter.customerId = query.customerId;
		}

		// Workers can only see their own orders
		if (user.role === UserRole.WORKER) {
			filter.workerId = user.id;
		} else if (query.workerId) {
			filter.workerId = query.workerId;
		}

		const skip = (query.page - 1) * query.limit;

		const [orders, total] = await Promise.all([
			Order.find(filter)
				.sort({ orderDate: -1 })
				.skip(skip)
				.limit(query.limit)
				.populate("customerId", "name phone address"),
			Order.countDocuments(filter),
		]);

		return c.json({
			message: "Orders retrieved successfully",
			data: orders,
			pagination: {
				total,
				page: query.page,
				limit: query.limit,
				pages: Math.ceil(total / query.limit),
			},
		});
	},
);

// Get pending orders (ADMIN/WORKER)
app.get(
	"/pending",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);

		const filter: any = {
			orgId: orgFilter,
			status: { $in: ["PENDING", "PARTIAL"] },
		};

		// Workers can only see their own orders
		if (user.role === UserRole.WORKER) {
			filter.workerId = user.id;
		}

		const orders = await Order.find(filter)
			.sort({ orderDate: -1 })
			.populate("customerId", "name phone address")
			.limit(50);

		return c.json({
			message: "Pending orders retrieved successfully",
			data: orders,
		});
	},
);

// Get worker's orders (ADMIN/Own WORKER)
app.get(
	"/worker/:workerId",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getWorkerOrdersParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { workerId } = c.req.valid("param");

		// Workers can only view their own orders
		if (user.role === UserRole.WORKER && user.id !== workerId) {
			throw new HTTPException(403, {
				message: "You can only view your own orders",
			});
		}

		const orders = await Order.find({
			orgId: orgFilter,
			workerId,
		})
			.sort({ orderDate: -1 })
			.populate("customerId", "name phone address")
			.limit(100);

		return c.json({
			message: "Worker orders retrieved successfully",
			data: orders,
		});
	},
);

// Get single order with items (ADMIN/Own WORKER)
app.get(
	"/:id",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getOrderParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		const order = await Order.findOne({ _id: id, orgId: orgFilter }).populate(
			"customerId",
			"name phone address",
		);

		if (!order) {
			throw new HTTPException(404, { message: "Order not found" });
		}

		// Workers can only view their own orders
		if (user.role === UserRole.WORKER && order.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only view your own orders",
			});
		}

		// Get order items
		const items = await OrderItem.find({ orderId: id }).populate(
			"productId",
			"name sku unit unitsPerCase packSize",
		);

		return c.json({
			message: "Order retrieved successfully",
			data: {
				...order.toObject(),
				items,
			},
		});
	},
);

// Create order (WORKER)
app.post(
	"/",
	requireAuth,
	requireRole(UserRole.WORKER),
	zValidator("json", createOrderBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const body = c.req.valid("json");

		// Verify customer exists
		const customer = await Customer.findOne({
			_id: body.customerId,
			orgId: orgFilter,
		});

		if (!customer) {
			throw new HTTPException(404, { message: "Customer not found" });
		}

		// Verify all products exist and calculate totals
		let subtotal = 0;
		const itemsWithDetails = [];

		for (const item of body.items) {
			const product = await Product.findOne({
				_id: item.productId,
				orgId: orgFilter,
			});

			if (!product) {
				throw new HTTPException(404, {
					message: `Product ${item.productId} not found`,
				});
			}

			const quantity = item.cases * product.unitsPerCase + item.units;
			const itemTotal = quantity * item.price;
			subtotal += itemTotal;

			itemsWithDetails.push({
				productId: item.productId,
				quantity,
				deliveredQuantity: 0,
				pendingQuantity: quantity,
				cases: item.cases,
				units: item.units,
				deliveredCases: 0,
				deliveredUnits: 0,
				price: item.price,
				total: itemTotal,
				unitsPerCase: product.unitsPerCase,
			});
		}

		const total = subtotal - body.discount;

		// Generate order number
		const orderNo = await generateOrderNumber(organizationId);

		// Create order
		const order = await Order.create({
			orgId: organizationId,
			orderNo,
			customerId: body.customerId,
			workerId: user.id,
			orderDate: new Date(),
			expectedDeliveryDate: body.expectedDeliveryDate
				? new Date(body.expectedDeliveryDate)
				: undefined,
			status: "PENDING",
			deliveryType: body.deliveryType,
			subtotal,
			discount: body.discount,
			total,
			note: body.note,
			createdBy: user.id,
		});

		// Create order items
		const orderItems = await OrderItem.insertMany(
			itemsWithDetails.map((item) => ({
				orderId: order._id,
				...item,
			})),
		);

		return c.json(
			{
				message: "Order created successfully",
				order,
				items: orderItems,
			},
			201,
		);
	},
);

// Update order (ADMIN/Own WORKER)
app.put(
	"/:id",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getOrderParamsSchema),
	zValidator("json", updateOrderBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");

		const order = await Order.findOne({ _id: id, orgId: orgFilter });

		if (!order) {
			throw new HTTPException(404, { message: "Order not found" });
		}

		// Workers can only update their own orders
		if (user.role === UserRole.WORKER && order.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only update your own orders",
			});
		}

		// Only update if order is still pending
		if (order.status !== "PENDING") {
			throw new HTTPException(400, {
				message: "Can only update pending orders",
			});
		}

		const updatedOrder = await Order.findByIdAndUpdate(
			id,
			{ ...body },
			{ new: true },
		).populate("customerId", "name phone address");

		return c.json({
			message: "Order updated successfully",
			data: updatedOrder,
		});
	},
);

// Update order status (ADMIN/Own WORKER)
app.patch(
	"/:id/status",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getOrderParamsSchema),
	zValidator("json", updateOrderStatusBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");

		const order = await Order.findOne({ _id: id, orgId: orgFilter });

		if (!order) {
			throw new HTTPException(404, { message: "Order not found" });
		}

		// Workers can only update their own orders
		if (user.role === UserRole.WORKER && order.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only update your own orders",
			});
		}

		order.status = body.status;
		if (body.note) {
			order.note = `${order.note || ""}\n${body.note}`.trim();
		}
		await order.save();

		return c.json({
			message: "Order status updated successfully",
			data: order,
		});
	},
);

// Cancel order (ADMIN/Own WORKER)
app.delete(
	"/:id",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getOrderParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		const order = await Order.findOne({ _id: id, orgId: orgFilter });

		if (!order) {
			throw new HTTPException(404, { message: "Order not found" });
		}

		// Workers can only cancel their own orders
		if (user.role === UserRole.WORKER && order.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only cancel your own orders",
			});
		}

		// Only cancel if not already delivered
		if (order.status === "DELIVERED") {
			throw new HTTPException(400, {
				message: "Cannot cancel delivered orders",
			});
		}

		order.status = "CANCELLED";
		await order.save();

		return c.json({ message: "Order cancelled successfully" });
	},
);

// Deliver order and create sale (WORKER - own orders only)
app.post(
	"/:id/deliver",
	requireAuth,
	requireRole(UserRole.WORKER),
	zValidator("param", getOrderParamsSchema),
	zValidator("json", deliverOrderBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");

		// Get order
		const order = await Order.findOne({ _id: id, orgId: orgFilter });

		if (!order) {
			throw new HTTPException(404, { message: "Order not found" });
		}

		// Worker can only deliver own orders
		if (order.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only deliver your own orders",
			});
		}

		if (order.status === "DELIVERED") {
			throw new HTTPException(400, { message: "Order already delivered" });
		}

		if (order.status === "CANCELLED") {
			throw new HTTPException(400, {
				message: "Cannot deliver cancelled order",
			});
		}

		// Get all order items
		const orderItems = await OrderItem.find({ orderId: id }).populate(
			"productId",
		);

		// Process each delivered item
		let subtotal = 0;
		const saleItems = [];

		for (const deliveryItem of body.items) {
			const orderItem = orderItems.find(
				(oi) => oi._id === deliveryItem.orderItemId,
			);

			if (!orderItem) {
				throw new HTTPException(404, {
					message: `Order item ${deliveryItem.orderItemId} not found`,
				});
			}

			const product = orderItem.productId as any;
			const deliveredQty =
				deliveryItem.deliveredCases * product.unitsPerCase +
				deliveryItem.deliveredUnits;

			// Check worker stock
			const workerStock = await WorkerStock.findOne({
				orgId: organizationId,
				workerId: user.id,
				productId: product._id,
			});

			if (!workerStock || workerStock.quantity < deliveredQty) {
				throw new HTTPException(400, {
					message: `Insufficient stock for product ${product.name}. Available: ${workerStock?.quantity || 0}, Required: ${deliveredQty}`,
				});
			}

			// Update order item
			orderItem.deliveredQuantity += deliveredQty;
			orderItem.deliveredCases += deliveryItem.deliveredCases;
			orderItem.deliveredUnits += deliveryItem.deliveredUnits;
			orderItem.pendingQuantity =
				orderItem.quantity - orderItem.deliveredQuantity;
			await orderItem.save();

			// Deduct from worker stock
			workerStock.quantity -= deliveredQty;
			await workerStock.save();

			// Create stock transaction
			await StockTransaction.create({
				orgId: organizationId,
				productId: product._id,
				workerId: user.id,
				type: "SALE",
				quantity: deliveredQty,
				cases: deliveryItem.deliveredCases,
				units: deliveryItem.deliveredUnits,
				referenceId: order._id,
				note: `Order ${order.orderNo} delivery`,
				createdBy: user.id,
			});

			// Prepare sale item
			const itemTotal = deliveredQty * orderItem.price;
			subtotal += itemTotal;

			saleItems.push({
				productId: product._id,
				quantity: deliveredQty,
				cases: deliveryItem.deliveredCases,
				units: deliveryItem.deliveredUnits,
				price: orderItem.price,
				total: itemTotal,
			});
		}

		const total = subtotal - order.discount;

		// Check if order is fully delivered
		const allItems = await OrderItem.find({ orderId: id });
		const fullyDelivered = allItems.every(
			(item) => item.deliveredQuantity >= item.quantity,
		);
		const partiallyDelivered = allItems.some(
			(item) => item.deliveredQuantity > 0,
		);

		order.status = fullyDelivered
			? "DELIVERED"
			: partiallyDelivered
				? "PARTIAL"
				: "PENDING";

		// Generate invoice number
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, "0");
		const saleCount = await Sale.countDocuments({
			orgId: organizationId,
			createdAt: { $gte: new Date(year, today.getMonth(), 1) },
		});
		const invoiceNo = `INV-${year}${month}-${String(saleCount + 1).padStart(4, "0")}`;

		// Create sale
		const sale = await Sale.create({
			orgId: organizationId,
			invoiceNo,
			customerId: order.customerId,
			workerId: user.id,
			orderId: order._id,
			saleDate: new Date(),
			subtotal,
			discount: order.discount,
			total,
			paymentStatus:
				body.paidAmount >= total
					? "PAID"
					: body.paidAmount > 0
						? "PARTIAL"
						: "PENDING",
			paidAmount: body.paidAmount,
			pendingAmount: total - body.paidAmount,
			note: body.note,
			createdBy: user.id,
		});

		// Create sale items
		await SaleItem.insertMany(
			saleItems.map((item) => ({
				saleId: sale._id,
				...item,
			})),
		);

		// Create payment if paid amount > 0
		if (body.paidAmount > 0) {
			await Payment.create({
				orgId: organizationId,
				saleId: sale._id,
				amount: body.paidAmount,
				paymentMethod: body.paymentMethod,
				paymentDate: new Date(),
				note: body.note,
				createdBy: user.id,
			});
		}

		// Update order with sale reference
		order.saleId = sale._id;
		await order.save();

		return c.json(
			{
				message: "Order delivered and sale created successfully",
				order,
				sale,
			},
			201,
		);
	},
);

// Continue in next part...
export default app;
