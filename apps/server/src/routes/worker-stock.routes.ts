import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Payment, Product, Sale, StockTransaction, WorkerStock } from "@msl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import mongoose from "mongoose";

import { organizationFilter, resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import { requireAdmin } from "@/middleware/authorization.middleware";
import {
	closeDaySettlementBodySchema,
	getWorkerProductStockParamsSchema,
	getWorkerStockParamsSchema,
} from "@/schemas/worker-stock.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Get all workers' live stock and day-end financial summary (Admin only)
app.get("/all", requireAuth, requireAdmin, async (c) => {
	const organizationId = await resolveOrganizationId(c);
	const orgFilter = organizationFilter(organizationId);

	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);

	// 1. Fetch live worker stocks
	const workerStocks = await WorkerStock.find({
		orgId: orgFilter,
		quantity: { $gt: 0 },
	})
		.populate(
			"productId",
			"name sku unitsPerCase unit packSize sellingRate purchaseRate",
		)
		.sort({ workerId: 1, createdAt: -1 });

	// 2. Fetch today's sales grouped by worker
	const todaySales = await Sale.aggregate([
		{
			$match: {
				orgId: orgFilter,
				status: { $ne: "CANCELLED" },
				createdAt: { $gte: startOfToday },
			},
		},
		{
			$group: {
				_id: "$workerId",
				count: { $sum: 1 },
				totalSales: { $sum: "$total" },
				totalPaid: { $sum: "$paidAmount" },
				totalPending: { $sum: "$pendingAmount" },
			},
		},
	]);

	// 3. Fetch today's payment collections grouped by worker and method
	const todayPayments = await Payment.aggregate([
		{
			$match: {
				orgId: orgFilter,
				createdAt: { $gte: startOfToday },
			},
		},
		{
			$group: {
				_id: { workerId: "$createdBy", method: "$paymentMethod" },
				total: { $sum: "$amount" },
			},
		},
	]);

	// 4. Fetch users collection to resolve worker names and details
	const userDocs = await mongoose.connection.db
		?.collection("user")
		.find({})
		.toArray();

	const userMap = new Map<string, any>();
	userDocs?.forEach((u) => {
		const idStr = u._id?.toString() || u.id;
		userMap.set(idStr, u);
	});

	// Build maps for fast O(1) lookup
	const salesMap = new Map(todaySales.map((s) => [s._id, s]));

	const paymentMap = new Map<string, { cash: number; upi: number }>();
	todayPayments.forEach((p) => {
		const wId = p._id?.workerId;
		if (!wId) return;
		const current = paymentMap.get(wId) || { cash: 0, upi: 0 };
		if (p._id?.method === "CASH") {
			current.cash += p.total;
		} else if (p._id?.method === "UPI") {
			current.upi += p.total;
		}
		paymentMap.set(wId, current);
	});

	// Group stock by worker
	const groupedByWorker = workerStocks.reduce((acc: any, stock: any) => {
		const workerId = stock.workerId;
		const userObj = userMap.get(workerId);

		if (!acc[workerId]) {
			const salesData = salesMap.get(workerId);
			const paymentsData = paymentMap.get(workerId) || { cash: 0, upi: 0 };

			acc[workerId] = {
				workerId,
				workerName: userObj?.name || `Worker (${workerId.slice(-4)})`,
				workerEmail: userObj?.email || "",
				workerImage: userObj?.image || null,
				products: [],
				totalItems: 0,
				totalUnits: 0,
				totalCases: 0,
				stockValue: 0,
				todayStats: {
					billsCount: salesData?.count || 0,
					totalSales: salesData?.totalSales || 0,
					cashCollected: paymentsData.cash,
					upiCollected: paymentsData.upi,
					totalCollected: paymentsData.cash + paymentsData.upi,
					pendingCredit: salesData?.totalPending || 0,
				},
			};
		}

		const product = stock.productId;
		if (product) {
			const stockInCases = Math.floor(
				stock.quantity / (product.unitsPerCase || 1),
			);
			const remainingUnits = stock.quantity % (product.unitsPerCase || 1);
			// Use sellingRate first, fall back to purchaseRate if 0
			const sellingRate =
				product.sellingRate > 0
					? product.sellingRate
					: product.purchaseRate || 0;
			const itemValue = stock.quantity * sellingRate;

			acc[workerId].products.push({
				productId: product._id,
				productName: product.name,
				sku: product.sku,
				packSize: product.packSize,
				quantity: stock.quantity,
				stockInCases,
				remainingUnits,
				unit: product.unit || "pcs",
				unitsPerCase: product.unitsPerCase || 1,
				sellingRate,
				itemValue,
			});

			acc[workerId].totalItems += 1;
			acc[workerId].totalUnits += stock.quantity;
			acc[workerId].totalCases += stockInCases;
			acc[workerId].stockValue += itemValue;
		}

		return acc;
	}, {});

	// Also include workers who had sales/payments today even if current stock is 0
	todaySales.forEach((s) => {
		const workerId = s._id;
		if (!workerId || groupedByWorker[workerId]) return;

		const userObj = userMap.get(workerId);
		const paymentsData = paymentMap.get(workerId) || { cash: 0, upi: 0 };

		groupedByWorker[workerId] = {
			workerId,
			workerName: userObj?.name || `Worker (${workerId.slice(-4)})`,
			workerEmail: userObj?.email || "",
			workerImage: userObj?.image || null,
			products: [],
			totalItems: 0,
			totalUnits: 0,
			totalCases: 0,
			stockValue: 0,
			todayStats: {
				billsCount: s.count || 0,
				totalSales: s.totalSales || 0,
				cashCollected: paymentsData.cash,
				upiCollected: paymentsData.upi,
				totalCollected: paymentsData.cash + paymentsData.upi,
				pendingCredit: s.totalPending || 0,
			},
		};
	});

	const workers = Object.values(groupedByWorker);

	// Overall fleet summary
	const overallSummary = {
		totalWorkers: workers.length,
		totalUnitsInVans: workers.reduce(
			(sum: number, w: any) => sum + w.totalUnits,
			0,
		),
		totalCasesInVans: workers.reduce(
			(sum: number, w: any) => sum + w.totalCases,
			0,
		),
		totalStockValue: workers.reduce(
			(sum: number, w: any) => sum + w.stockValue,
			0,
		),
		totalTodaySales: workers.reduce(
			(sum: number, w: any) => sum + w.todayStats.totalSales,
			0,
		),
		totalCashToCollect: workers.reduce(
			(sum: number, w: any) => sum + w.todayStats.cashCollected,
			0,
		),
		totalUpiCollected: workers.reduce(
			(sum: number, w: any) => sum + w.todayStats.upiCollected,
			0,
		),
	};

	return c.json({
		message: "Worker stock and day-end summary retrieved successfully",
		summary: overallSummary,
		data: workers,
	});
});

// Day-End Settlement - Reconcile cash and optionally return van stock to warehouse
app.post(
	"/close-day",
	requireAuth,
	requireAdmin,
	zValidator("json", closeDaySettlementBodySchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const body = c.req.valid("json");

		const workerStocks = await WorkerStock.find({
			orgId: orgFilter,
			workerId: body.workerId,
			quantity: { $gt: 0 },
		}).populate("productId", "name unitsPerCase");

		let totalReturnedUnits = 0;
		let totalReturnedCases = 0;

		if (body.returnAllStockToWarehouse && workerStocks.length > 0) {
			for (const ws of workerStocks) {
				const qty = ws.quantity;
				if (qty > 0) {
					// Return to warehouse product stock
					await Product.updateOne(
						{ _id: ws.productId },
						{ $inc: { stock: qty } },
					);

					const product = ws.productId as any;
					const unitsPerCase = product?.unitsPerCase || 1;
					const cases = Math.floor(qty / unitsPerCase);
					const units = qty % unitsPerCase;

					// Create StockTransaction
					await StockTransaction.create({
						orgId: organizationId,
						productId: ws.productId,
						workerId: body.workerId,
						type: "RETURN",
						quantity: qty,
						cases,
						units,
						note: body.note || "Day-End Settlement: Returned to Warehouse",
						createdBy: user.id,
					});

					totalReturnedUnits += qty;
					totalReturnedCases += cases;

					ws.quantity = 0;
					await ws.save();
				}
			}
		}

		return c.json({
			success: true,
			message: "Day-End Closing and Settlement completed successfully",
			settlement: {
				workerId: body.workerId,
				cashReceived: body.cashReceived,
				stockReturned: body.returnAllStockToWarehouse,
				totalReturnedUnits,
				totalReturnedCases,
				settledAt: new Date().toISOString(),
				settledBy: user.name || user.id,
			},
		});
	},
);

// Get specific worker's stock (All authenticated users - own data only)
app.get(
	"/:workerId",
	requireAuth,
	zValidator("param", getWorkerStockParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { workerId } = c.req.valid("param");

		// Non-admin users can only view their own stock
		if (user.role !== "admin" && user.id !== workerId) {
			throw new HTTPException(403, {
				message: "You can only view your own stock",
			});
		}

		const workerStocks = await WorkerStock.find({
			orgId: orgFilter,
			workerId,
			quantity: { $gt: 0 }, // Only show non-zero stocks
		})
			.populate("productId", "name sku unitsPerCase unit packSize")
			.sort({ createdAt: -1 });

		const products = workerStocks.map((stock: any) => {
			const product = stock.productId;
			const stockInCases = Math.floor(stock.quantity / product.unitsPerCase);
			const remainingUnits = stock.quantity % product.unitsPerCase;

			return {
				_id: stock._id,
				productId: product._id,
				productName: product.name,
				sku: product.sku,
				packSize: product.packSize,
				quantity: stock.quantity,
				stockInCases,
				remainingUnits,
				stockDisplay:
					remainingUnits > 0
						? `${stockInCases} Cases + ${remainingUnits} ${product.unit}s`
						: `${stockInCases} Cases`,
				unit: product.unit,
				unitsPerCase: product.unitsPerCase,
				updatedAt: stock.updatedAt,
			};
		});

		return c.json({
			message: "Worker stock retrieved successfully",
			workerId,
			data: products,
			totalProducts: products.length,
			totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
		});
	},
);

// Get specific product stock for a worker (All authenticated users - own data only)
app.get(
	"/:workerId/:productId",
	requireAuth,
	zValidator("param", getWorkerProductStockParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { workerId, productId } = c.req.valid("param");

		// Non-admin users can only view their own stock
		if (user.role !== "admin" && user.id !== workerId) {
			throw new HTTPException(403, {
				message: "You can only view your own stock",
			});
		}

		const workerStock = await WorkerStock.findOne({
			orgId: orgFilter,
			workerId,
			productId,
		}).populate("productId", "name sku unitsPerCase unit packSize");

		if (!workerStock) {
			throw new HTTPException(404, {
				message: "Stock not found for this worker and product",
			});
		}

		const product = workerStock.productId as any;
		const stockInCases = Math.floor(
			workerStock.quantity / product.unitsPerCase,
		);
		const remainingUnits = workerStock.quantity % product.unitsPerCase;

		return c.json({
			message: "Worker product stock retrieved successfully",
			_id: workerStock._id,
			workerId: workerStock.workerId,
			productId: product._id,
			productName: product.name,
			sku: product.sku,
			packSize: product.packSize,
			quantity: workerStock.quantity,
			stockInCases,
			remainingUnits,
			stockDisplay:
				remainingUnits > 0
					? `${stockInCases} Cases + ${remainingUnits} ${product.unit}s`
					: `${stockInCases} Cases`,
			unit: product.unit,
			unitsPerCase: product.unitsPerCase,
			updatedAt: workerStock.updatedAt,
		});
	},
);

export default app;
