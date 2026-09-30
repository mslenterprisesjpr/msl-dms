import { zValidator } from "@hono/zod-validator";
import { Product, StockTransaction, WorkerStock } from "@msl/db";
import type { Session, User } from "better-auth/types";
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
	adjustStockBodySchema,
	getTransactionsQuerySchema,
	issueStockBodySchema,
	purchaseStockBodySchema,
	returnStockBodySchema,
} from "@/schemas/stock.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Purchase stock - Add stock to warehouse (ADMIN only)
app.post(
	"/purchase",
	requireAuth,
	requireAdmin,
	zValidator("json", purchaseStockBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const body = c.req.valid("json");

		// Check if product exists and belongs to org
		const product = await Product.findOne({
			_id: body.productId,
			orgId: orgFilter,
		});

		if (!product) {
			throw new HTTPException(404, { message: "Product not found" });
		}

		// Calculate total quantity in units
		const totalQuantity = body.cases * product.unitsPerCase + body.units;

		// Update product stock
		product.stock += totalQuantity;
		await product.save();

		// Create transaction record
		const transaction = await StockTransaction.create({
			orgId: organizationId,
			productId: body.productId,
			type: "PURCHASE",
			quantity: totalQuantity,
			cases: body.cases,
			units: body.units,
			note: body.note,
			createdBy: user.id,
		});

		return c.json(
			{
				message: "Stock purchased successfully",
				transaction,
				newStock: product.stock,
			},
			201,
		);
	},
);

// Issue stock to worker - Transfer from warehouse to worker (ADMIN only)
app.post(
	"/issue",
	requireAuth,
	requireAdmin,
	zValidator("json", issueStockBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const body = c.req.valid("json");

		// Check if product exists and belongs to org
		const product = await Product.findOne({
			_id: body.productId,
			orgId: orgFilter,
		});

		if (!product) {
			throw new HTTPException(404, { message: "Product not found" });
		}

		// Calculate total quantity in units
		const totalQuantity = body.cases * product.unitsPerCase + body.units;

		// Check if warehouse has enough stock
		if (product.stock < totalQuantity) {
			throw new HTTPException(400, {
				message: `Insufficient stock. Available: ${product.stock} units, Requested: ${totalQuantity} units`,
			});
		}

		// Deduct from warehouse stock
		product.stock -= totalQuantity;
		await product.save();

		// Add to or update worker stock
		let workerStock = await WorkerStock.findOne({
			orgId: organizationId,
			workerId: body.workerId,
			productId: body.productId,
		});

		if (workerStock) {
			workerStock.quantity += totalQuantity;
			await workerStock.save();
		} else {
			workerStock = await WorkerStock.create({
				orgId: organizationId,
				workerId: body.workerId,
				productId: body.productId,
				quantity: totalQuantity,
			});
		}

		// Create transaction record
		const transaction = await StockTransaction.create({
			orgId: organizationId,
			productId: body.productId,
			workerId: body.workerId,
			type: "ISSUE",
			quantity: totalQuantity,
			cases: body.cases,
			units: body.units,
			note: body.note,
			createdBy: user.id,
		});

		return c.json(
			{
				message: "Stock issued to worker successfully",
				transaction,
				warehouseStock: product.stock,
				workerStock: workerStock.quantity,
			},
			201,
		);
	},
);

// Return stock from worker - Transfer from worker back to warehouse (ADMIN/WORKER)
app.post(
	"/return",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("json", returnStockBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const body = c.req.valid("json");

		// Check if product exists and belongs to org
		const product = await Product.findOne({
			_id: body.productId,
			orgId: orgFilter,
		});

		if (!product) {
			throw new HTTPException(404, { message: "Product not found" });
		}

		// Calculate total quantity in units
		const totalQuantity = body.cases * product.unitsPerCase + body.units;

		// Determine worker ID (admin can return any worker's stock, worker can only return own)
		const workerId =
			user.role === UserRole.ADMIN ? body.workerId || user.id : user.id;

		// Check if worker has stock
		const workerStock = await WorkerStock.findOne({
			orgId: organizationId,
			workerId: workerId,
			productId: body.productId,
		});

		if (!workerStock) {
			throw new HTTPException(404, {
				message: "Worker has no stock for this product",
			});
		}

		if (workerStock.quantity < totalQuantity) {
			throw new HTTPException(400, {
				message: `Insufficient worker stock. Available: ${workerStock.quantity} units, Requested: ${totalQuantity} units`,
			});
		}

		// Deduct from worker stock
		workerStock.quantity -= totalQuantity;
		await workerStock.save();

		// Add back to warehouse stock
		product.stock += totalQuantity;
		await product.save();

		// Create transaction record
		const transaction = await StockTransaction.create({
			orgId: organizationId,
			productId: body.productId,
			workerId: workerId,
			type: "RETURN",
			quantity: totalQuantity,
			cases: body.cases,
			units: body.units,
			note: body.note,
			createdBy: user.id,
		});

		return c.json(
			{
				message: "Stock returned successfully",
				transaction,
				warehouseStock: product.stock,
				workerStock: workerStock.quantity,
			},
			201,
		);
	},
);

// Manual stock adjustment - Admin only for corrections (ADMIN only)
app.post(
	"/adjustment",
	requireAuth,
	requireAdmin,
	zValidator("json", adjustStockBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const body = c.req.valid("json");

		// Check if product exists and belongs to org
		const product = await Product.findOne({
			_id: body.productId,
			orgId: orgFilter,
		});

		if (!product) {
			throw new HTTPException(404, { message: "Product not found" });
		}

		// Check if adjustment would result in negative stock
		const newStock = product.stock + body.quantity;
		if (newStock < 0) {
			throw new HTTPException(400, {
				message: `Adjustment would result in negative stock. Current: ${product.stock}, Adjustment: ${body.quantity}`,
			});
		}

		// Update product stock
		const oldStock = product.stock;
		product.stock = newStock;
		await product.save();

		// Create transaction record
		const transaction = await StockTransaction.create({
			orgId: organizationId,
			productId: body.productId,
			type: "ADJUSTMENT",
			quantity: Math.abs(body.quantity),
			cases: 0,
			units: Math.abs(body.quantity),
			note: `${body.note} (Old: ${oldStock}, New: ${newStock})`,
			createdBy: user.id,
		});

		return c.json(
			{
				message: "Stock adjusted successfully",
				transaction,
				oldStock,
				newStock: product.stock,
				adjustment: body.quantity,
			},
			201,
		);
	},
);

// Get stock transaction history (ADMIN/WORKER)
app.get(
	"/transactions",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("query", getTransactionsQuerySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		// Build filter
		const filter: any = { orgId: orgFilter };

		if (query.type) {
			filter.type = query.type;
		}

		if (query.productId) {
			filter.productId = query.productId;
		}

		// Workers can only see their own transactions
		if (user.role === UserRole.WORKER) {
			filter.workerId = user.id;
		} else if (query.workerId) {
			// Admin can filter by worker
			filter.workerId = query.workerId;
		}

		const skip = (query.page - 1) * query.limit;

		const [transactions, total] = await Promise.all([
			StockTransaction.find(filter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(query.limit)
				.populate("productId", "name sku unitsPerCase unit"),
			StockTransaction.countDocuments(filter),
		]);

		return c.json({
			data: transactions,
			pagination: {
				total,
				page: query.page,
				limit: query.limit,
				pages: Math.ceil(total / query.limit),
			},
		});
	},
);

// Get warehouse stock summary (ADMIN only)
app.get("/warehouse", requireAuth, requireAdmin, async (c) => {
	const organizationId = await resolveOrganizationId(c);
	const orgFilter = organizationFilter(organizationId);

	const products = await Product.find({
		orgId: orgFilter,
		isActive: true,
	}).sort({ name: 1 });

	const summary = products.map((product) => {
		const stockInCases = Math.floor(product.stock / product.unitsPerCase);
		const remainingUnits = product.stock % product.unitsPerCase;
		const minimumStockInUnits = product.minimumStock * product.unitsPerCase;
		const isLowStock = product.stock <= minimumStockInUnits;

		return {
			productId: product._id,
			name: product.name,
			sku: product.sku,
			stock: product.stock,
			stockInCases,
			remainingUnits,
			minimumStock: product.minimumStock,
			isLowStock,
			unit: product.unit,
			unitsPerCase: product.unitsPerCase,
		};
	});

	return c.json({
		data: summary,
		lowStockCount: summary.filter((p) => p.isLowStock).length,
	});
});

export default app;
