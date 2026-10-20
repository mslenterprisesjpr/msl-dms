import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Customer, Payment, Sale } from "@msl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { organizationFilter, resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import { requireAdmin } from "@/middleware/authorization.middleware";
import {
	createCustomerBodySchema,
	getCustomerParamsSchema,
	getCustomersQuerySchema,
	updateCustomerBodySchema,
} from "@/schemas/customer.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Get all customers with search and pagination (All authenticated users)
app.get(
	"/",
	requireAuth,
	zValidator("query", getCustomersQuerySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		// Build filter - always filter by orgId
		const filter: any = { orgId: orgFilter };

		if (query.search) {
			filter.$or = [
				{ name: { $regex: query.search, $options: "i" } },
				{ phone: { $regex: query.search, $options: "i" } },
				{ gstNumber: { $regex: query.search, $options: "i" } },
			];
		}

		if (query.isActive !== undefined) {
			filter.isActive = query.isActive;
		}

		const skip = (query.page - 1) * query.limit;

		const [customers, total] = await Promise.all([
			Customer.find(filter).sort({ name: 1 }).skip(skip).limit(query.limit),
			Customer.countDocuments(filter),
		]);

		return c.json({
			message: "Customers retrieved successfully",
			data: customers,
			pagination: {
				total,
				page: query.page,
				limit: query.limit,
				pages: Math.ceil(total / query.limit),
			},
		});
	},
);

// Search customers by name or phone (All authenticated users)
app.get(
	"/search",
	requireAuth,
	zValidator(
		"query",
		z.object({ q: z.string().min(1, "Search query is required") }),
	),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { q } = c.req.valid("query");

		const customers = await Customer.find({
			orgId: orgFilter,
			isActive: true,
			$or: [
				{ name: { $regex: q, $options: "i" } },
				{ phone: { $regex: q, $options: "i" } },
				{ gstNumber: { $regex: q, $options: "i" } },
			],
		})
			.limit(20)
			.sort({ name: 1 });

		return c.json({ message: "Customers found", data: customers });
	},
);

// Get customer khata ledger & statement (All authenticated users)
app.get(
	"/:id/ledger",
	requireAuth,
	zValidator("param", getCustomerParamsSchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		const customer = await Customer.findOne({ _id: id, orgId: orgFilter });
		if (!customer) {
			throw new HTTPException(404, { message: "Customer not found" });
		}

		// Fetch all non-cancelled sales for this customer
		const sales = await Sale.find({
			orgId: orgFilter,
			customerId: id,
			status: { $ne: "CANCELLED" },
		})
			.sort({ saleDate: 1, createdAt: 1 })
			.lean();

		const saleIds = sales.map((s) => s._id);

		// Fetch all payments for these sales
		const payments = await Payment.find({
			orgId: orgFilter,
			saleId: { $in: saleIds },
		})
			.sort({ paymentDate: 1, createdAt: 1 })
			.lean();

		// Calculate summary totals
		const totalBilled = sales.reduce((sum, s) => sum + (s.total || 0), 0);
		const totalPaid = sales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
		const totalPending = Math.max(0, totalBilled - totalPaid);
		const unpaidSales = sales.filter((s) => s.paymentStatus !== "PAID");

		// Build chronological ledger events
		type LedgerEvent = {
			id: string;
			type: "INVOICE" | "PAYMENT";
			date: string;
			referenceNo: string;
			title: string;
			debit: number;
			credit: number;
			runningBalance: number;
			status?: string;
			paidAmount?: number;
			pendingAmount?: number;
			paymentMethod?: string;
			note?: string;
			saleId?: string;
		};

		const events: Omit<LedgerEvent, "runningBalance">[] = [];

		for (const sale of sales) {
			events.push({
				id: sale._id,
				type: "INVOICE",
				date: (sale.saleDate || sale.createdAt || new Date()).toISOString(),
				referenceNo: sale.invoiceNo,
				title: `Bill #${sale.invoiceNo}`,
				debit: sale.total || 0,
				credit: 0,
				status: sale.paymentStatus,
				paidAmount: sale.paidAmount || 0,
				pendingAmount: sale.pendingAmount || 0,
				note: sale.note,
				saleId: sale._id,
			});
		}

		const salesMap = new Map(sales.map((s) => [s._id, s.invoiceNo]));

		for (const payment of payments) {
			const invNo = salesMap.get(payment.saleId);
			events.push({
				id: payment._id,
				type: "PAYMENT",
				date: (
					payment.paymentDate ||
					payment.createdAt ||
					new Date()
				).toISOString(),
				referenceNo: payment._id,
				title: `Payment Received (${payment.paymentMethod || "CASH"})`,
				debit: 0,
				credit: payment.amount || 0,
				paymentMethod: payment.paymentMethod,
				note: payment.note
					? `${payment.note}${invNo ? ` (for #${invNo})` : ""}`
					: invNo
						? `Payment for #${invNo}`
						: undefined,
				saleId: payment.saleId,
			});
		}

		// Sort chronologically ascending to compute running balance
		events.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);

		let running = 0;
		const ledgerWithBalance: LedgerEvent[] = events.map((ev) => {
			running += ev.debit - ev.credit;
			return {
				...ev,
				runningBalance: Math.max(0, running),
			};
		});

		// Sort newest first for timeline view
		const timeline = [...ledgerWithBalance].reverse();

		return c.json({
			message: "Customer khata ledger retrieved successfully",
			customer,
			summary: {
				totalBilled,
				totalPaid,
				totalPending,
				totalBillsCount: sales.length,
				unpaidBillsCount: unpaidSales.length,
			},
			timeline,
			unpaidInvoices: unpaidSales.reverse(),
		});
	},
);

// Get single customer (All authenticated users)
app.get(
	"/:id",
	requireAuth,
	zValidator("param", getCustomerParamsSchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		const customer = await Customer.findOne({ _id: id, orgId: orgFilter });

		if (!customer) {
			throw new HTTPException(404, { message: "Customer not found" });
		}

		return c.json({
			message: "Customer retrieved successfully",
			data: customer,
		});
	},
);

// Create customer (All authenticated users)
app.post(
	"/",
	requireAuth,
	zValidator("json", createCustomerBodySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const body = c.req.valid("json");

		// Check if phone already exists (if provided)
		if (body.phone) {
			const existingCustomer = await Customer.findOne({
				orgId: organizationId,
				phone: body.phone,
			});

			if (existingCustomer) {
				throw new HTTPException(400, {
					message: "Customer with this phone number already exists",
				});
			}
		}

		const customer = await Customer.create({
			...body,
			orgId: organizationId,
		});

		return c.json(
			{ message: "Customer created successfully", data: customer },
			201,
		);
	},
);

// Update customer (All authenticated users)
app.put(
	"/:id",
	requireAuth,
	zValidator("param", getCustomerParamsSchema),
	zValidator("json", updateCustomerBodySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");

		// Check if customer exists and belongs to user's org
		const existingCustomer = await Customer.findOne({
			_id: id,
			orgId: orgFilter,
		});

		if (!existingCustomer) {
			throw new HTTPException(404, { message: "Customer not found" });
		}

		// If phone is being updated, check for duplicates
		if (body.phone && body.phone !== existingCustomer.phone) {
			const duplicatePhone = await Customer.findOne({
				orgId: orgFilter,
				phone: body.phone,
				_id: { $ne: id },
			});

			if (duplicatePhone) {
				throw new HTTPException(400, {
					message: "Customer with this phone number already exists",
				});
			}
		}

		const customer = await Customer.findByIdAndUpdate(
			id,
			{ ...body },
			{ new: true },
		);

		return c.json({ message: "Customer updated successfully", data: customer });
	},
);

// Delete customer (ADMIN only) - Soft delete
app.delete(
	"/:id",
	requireAuth,
	requireAdmin,
	zValidator("param", getCustomerParamsSchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		// Check if customer exists and belongs to user's org
		const customer = await Customer.findOne({ _id: id, orgId: orgFilter });

		if (!customer) {
			throw new HTTPException(404, { message: "Customer not found" });
		}

		// Soft delete - just mark as inactive
		await Customer.findByIdAndUpdate(id, { isActive: false });

		return c.json({ message: "Customer deleted successfully" });
	},
);

export default app;
