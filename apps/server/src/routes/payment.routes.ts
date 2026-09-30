import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Payment, Sale } from "@msl/db";
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
	addPaymentBodySchema,
	getPaymentsBySaleParamsSchema,
	getPaymentsQuerySchema,
} from "@/schemas/payment.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Get all payments (ADMIN only)
app.get(
	"/",
	requireAuth,
	requireAdmin,
	zValidator("query", getPaymentsQuerySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		const filter: any = { orgId: orgFilter };

		if (query.saleId) {
			filter.saleId = query.saleId;
		}

		if (query.paymentMethod) {
			filter.paymentMethod = query.paymentMethod;
		}

		const skip = (query.page - 1) * query.limit;

		const [payments, total] = await Promise.all([
			Payment.find(filter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(query.limit)
				.populate("saleId", "invoiceNo total"),
			Payment.countDocuments(filter),
		]);

		return c.json({
			data: payments,
			pagination: {
				total,
				page: query.page,
				limit: query.limit,
				pages: Math.ceil(total / query.limit),
			},
		});
	},
);

// Get pending payments summary (ADMIN/WORKER)
app.get(
	"/pending",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);

		const saleFilter: any = {
			orgId: orgFilter,
			paymentStatus: { $in: ["PENDING", "PARTIAL"] },
			status: { $ne: "CANCELLED" },
		};

		// Workers can only see their own sales' pending payments
		if (user.role === UserRole.WORKER) {
			saleFilter.workerId = user.id;
		}

		const sales = await Sale.find(saleFilter)
			.sort({ createdAt: -1 })
			.populate("customerId", "name phone address")
			.limit(50);

		const summary = {
			totalSales: sales.length,
			totalPending: sales.reduce((sum, sale) => sum + sale.pendingAmount, 0),
			totalPartial: sales.filter((s) => s.paymentStatus === "PARTIAL").length,
			totalFullyPending: sales.filter((s) => s.paymentStatus === "PENDING")
				.length,
		};

		return c.json({
			data: sales,
			summary,
		});
	},
);

// Get payments for a specific sale (ADMIN/Own WORKER)
app.get(
	"/sale/:saleId",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getPaymentsBySaleParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { saleId } = c.req.valid("param");

		// Check if sale exists
		const sale = await Sale.findOne({ _id: saleId, orgId: orgFilter });

		if (!sale) {
			throw new HTTPException(404, { message: "Sale not found" });
		}

		// Workers can only view payments for their own sales
		if (user.role === UserRole.WORKER && sale.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only view payments for your own sales",
			});
		}

		const payments = await Payment.find({ saleId }).sort({ createdAt: -1 });

		return c.json({
			saleId,
			invoiceNo: sale.invoiceNo,
			total: sale.total,
			paidAmount: sale.paidAmount,
			pendingAmount: sale.pendingAmount,
			paymentStatus: sale.paymentStatus,
			payments,
		});
	},
);

// Add payment to a sale (WORKER)
app.post(
	"/",
	requireAuth,
	requireRole(UserRole.WORKER),
	zValidator("json", addPaymentBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const body = c.req.valid("json");

		// Check if sale exists
		const sale = await Sale.findOne({ _id: body.saleId, orgId: orgFilter });

		if (!sale) {
			throw new HTTPException(404, { message: "Sale not found" });
		}

		// Workers can only add payments to their own sales
		if (sale.workerId !== user.id) {
			throw new HTTPException(403, {
				message: "You can only add payments to your own sales",
			});
		}

		// Check if sale is cancelled
		if (sale.status === "CANCELLED") {
			throw new HTTPException(400, {
				message: "Cannot add payment to cancelled sale",
			});
		}

		// Check if payment amount is valid
		if (body.amount > sale.pendingAmount) {
			throw new HTTPException(400, {
				message: `Payment amount (${body.amount}) exceeds pending amount (${sale.pendingAmount})`,
			});
		}

		// Create payment
		const payment = await Payment.create({
			orgId: organizationId,
			saleId: body.saleId,
			amount: body.amount,
			paymentMethod: body.paymentMethod,
			paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
			note: body.note,
			createdBy: user.id,
		});

		// Update sale payment status
		sale.paidAmount += body.amount;
		sale.pendingAmount -= body.amount;

		if (sale.pendingAmount <= 0) {
			sale.paymentStatus = "PAID";
			sale.pendingAmount = 0;
		} else if (sale.paidAmount > 0) {
			sale.paymentStatus = "PARTIAL";
		}

		await sale.save();

		return c.json(
			{
				message: "Payment added successfully",
				payment,
				sale: {
					_id: sale._id,
					invoiceNo: sale.invoiceNo,
					total: sale.total,
					paidAmount: sale.paidAmount,
					pendingAmount: sale.pendingAmount,
					paymentStatus: sale.paymentStatus,
				},
			},
			201,
		);
	},
);

export default app;
