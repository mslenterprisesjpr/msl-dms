import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import {
	Customer,
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
import {
	requireAdmin,
	requireRole,
	UserRole,
} from "@/middleware/authorization.middleware";
import {
	createSaleBodySchema,
	getSaleByInvoiceParamsSchema,
	getSaleParamsSchema,
	getSalesQuerySchema,
	getWorkerSalesParamsSchema,
	updateSaleBodySchema,
} from "@/schemas/sale.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Helper function to generate invoice number
async function generateInvoiceNumber(orgId: string): Promise<string> {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");

	const startOfMonth = new Date(year, today.getMonth(), 1);
	const count = await Sale.countDocuments({
		orgId,
		createdAt: { $gte: startOfMonth },
	});

	const invoiceNum = String(count + 1).padStart(4, "0");
	return `INV-${year}${month}-${invoiceNum}`;
}

// Get all sales with filtering (ADMIN/WORKER)
app.get(
	"/",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("query", getSalesQuerySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		const filter: any = { orgId: orgFilter };

		if (query.paymentStatus) {
			filter.paymentStatus = query.paymentStatus;
		}

		if (query.status) {
			filter.status = query.status;
		}

		if (query.customerId) {
			filter.customerId = query.customerId;
		}

		// Workers can only see their own sales
		if (user.role === UserRole.WORKER) {
			filter.workerId = user.id;
		} else if (query.workerId) {
			filter.workerId = query.workerId;
		}

		const skip = (query.page - 1) * query.limit;

		const [sales, total] = await Promise.all([
			Sale.find(filter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(query.limit)
				.populate("customerId", "name phone address"),
			Sale.countDocuments(filter),
		]);

		return c.json({
			message: "Sales retrieved successfully",
			data: sales,
			pagination: {
				total,
				page: query.page,
				limit: query.limit,
				pages: Math.ceil(total / query.limit),
			},
		});
	},
);

// Get sales with pending payment (ADMIN/WORKER)
app.get(
	"/pending-payment",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);

		const filter: any = {
			orgId: orgFilter,
			paymentStatus: { $in: ["PENDING", "PARTIAL"] },
			status: { $ne: "CANCELLED" },
		};

		// Workers can only see their own sales
		if (user.role === UserRole.WORKER) {
			filter.workerId = user.id;
		}

		const sales = await Sale.find(filter)
			.sort({ createdAt: -1 })
			.populate("customerId", "name phone address")
			.limit(50);

		const totalPending = sales.reduce(
			(sum, sale) => sum + sale.pendingAmount,
			0,
		);

		return c.json({
			message: "Pending sales retrieved successfully",
			data: sales,
			totalPending,
		});
	},
);

// Get worker's sales (ADMIN/Own WORKER)
app.get(
	"/worker/:workerId",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getWorkerSalesParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { workerId } = c.req.valid("param");

		// Workers can only view their own sales
		if (user.role === UserRole.WORKER && user.id !== workerId) {
			throw new HTTPException(403, {
				message: "You can only view your own sales",
			});
		}

		const sales = await Sale.find({
			orgId: orgFilter,
			workerId,
		})
			.sort({ createdAt: -1 })
			.populate("customerId", "name phone address")
			.limit(100);

		return c.json({
			message: "Worker sales retrieved successfully",
			data: sales,
		});
	},
);

// Get sale by invoice number (ADMIN/WORKER)
app.get(
	"/invoice/:invoiceNo",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getSaleByInvoiceParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { invoiceNo } = c.req.valid("param");

		const sale = await Sale.findOne({ orgId: orgFilter, invoiceNo }).populate(
			"customerId",
			"name phone address",
		);

		if (!sale) {
			throw new HTTPException(404, { message: "Sale not found" });
		}

		// Workers can only view their own sales
		if (user.role === UserRole.WORKER && sale.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only view your own sales",
			});
		}

		// Get sale items
		const items = await SaleItem.find({ saleId: sale._id }).populate(
			"productId",
			"name sku unit unitsPerCase packSize",
		);

		// Get payments
		const payments = await Payment.find({ saleId: sale._id }).sort({
			paymentDate: -1,
		});

		return c.json({
			message: "Sale details retrieved successfully",
			data: {
				...sale.toObject(),
				items,
				payments,
			},
		});
	},
);

// Get single sale with items (ADMIN/Own WORKER)
app.get(
	"/:id",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getSaleParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		const sale = await Sale.findOne({ _id: id, orgId: orgFilter }).populate(
			"customerId",
			"name phone address",
		);

		if (!sale) {
			throw new HTTPException(404, { message: "Sale not found" });
		}

		// Workers can only view their own sales
		if (user.role === UserRole.WORKER && sale.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only view your own sales",
			});
		}

		// Get sale items
		const items = await SaleItem.find({ saleId: id }).populate(
			"productId",
			"name sku unit unitsPerCase packSize",
		);

		// Get payments
		const payments = await Payment.find({ saleId: id }).sort({
			paymentDate: -1,
		});

		return c.json({
			...sale.toObject(),
			items,
			payments,
		});
	},
);

// Create direct sale (WORKER - without order)
app.post(
	"/",
	requireAuth,
	requireRole(UserRole.WORKER),
	zValidator("json", createSaleBodySchema),
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

		// Verify products and check worker stock
		let subtotal = 0;
		const saleItems = [];

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

			// Check worker stock
			const workerStock = await WorkerStock.findOne({
				orgId: organizationId,
				workerId: user.id,
				productId: item.productId,
			});

			if (!workerStock || workerStock.quantity < quantity) {
				throw new HTTPException(400, {
					message: `Insufficient stock for product ${product.name}. Available: ${workerStock?.quantity || 0}, Required: ${quantity}`,
				});
			}

			const itemTotal = quantity * item.price;
			subtotal += itemTotal;

			saleItems.push({
				productId: item.productId,
				quantity,
				cases: item.cases,
				units: item.units,
				price: item.price,
				total: itemTotal,
				workerStock,
				product,
			});
		}

		const total = subtotal - body.discount;

		// Generate invoice number
		const invoiceNo = await generateInvoiceNumber(organizationId);

		// Create sale
		const sale = await Sale.create({
			orgId: organizationId,
			invoiceNo,
			customerId: body.customerId,
			workerId: user.id,
			subtotal,
			discount: body.discount,
			total,
			paidAmount: body.paidAmount,
			pendingAmount: total - body.paidAmount,
			paymentStatus:
				body.paidAmount >= total
					? "PAID"
					: body.paidAmount > 0
						? "PARTIAL"
						: "PENDING",
			status: "CONFIRMED",
			note: body.note,
			createdBy: user.id,
		});

		// Create sale items and update worker stock
		for (const item of saleItems) {
			// Create sale item
			await SaleItem.create({
				saleId: sale._id,
				productId: item.productId,
				quantity: item.quantity,
				cases: item.cases,
				units: item.units,
				price: item.price,
				total: item.total,
			});

			// Deduct from worker stock
			item.workerStock.quantity -= item.quantity;
			await item.workerStock.save();

			// Create stock transaction
			await StockTransaction.create({
				orgId: organizationId,
				productId: item.productId,
				workerId: user.id,
				type: "SALE",
				quantity: item.quantity,
				cases: item.cases,
				units: item.units,
				referenceId: sale._id,
				note: `Direct sale ${invoiceNo}`,
				createdBy: user.id,
			});
		}

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

		return c.json(
			{
				message: "Sale created successfully",
				sale,
			},
			201,
		);
	},
);

// Update sale (ADMIN only)
app.put(
	"/:id",
	requireAuth,
	requireAdmin,
	zValidator("param", getSaleParamsSchema),
	zValidator("json", updateSaleBodySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");

		const sale = await Sale.findOne({ _id: id, orgId: orgFilter });

		if (!sale) {
			throw new HTTPException(404, { message: "Sale not found" });
		}

		if (sale.status === "CANCELLED") {
			throw new HTTPException(400, {
				message: "Cannot update cancelled sale",
			});
		}

		if (body.discount !== undefined) {
			sale.discount = body.discount;
			sale.total = sale.subtotal - body.discount;
			sale.pendingAmount = sale.total - sale.paidAmount;
		}

		if (body.note !== undefined) {
			sale.note = body.note;
		}

		await sale.save();

		return c.json({ message: "Sale status updated successfully", data: sale });
	},
);

// Cancel sale (ADMIN only)
app.delete(
	"/:id",
	requireAuth,
	requireAdmin,
	zValidator("param", getSaleParamsSchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		const sale = await Sale.findOne({ _id: id, orgId: orgFilter });

		if (!sale) {
			throw new HTTPException(404, { message: "Sale not found" });
		}

		if (sale.status === "CANCELLED") {
			throw new HTTPException(400, {
				message: "Sale already cancelled",
			});
		}

		sale.status = "CANCELLED";
		await sale.save();

		return c.json({ message: "Sale cancelled successfully" });
	},
);

export default app;
