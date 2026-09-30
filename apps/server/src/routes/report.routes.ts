import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Payment, Product, Sale, WorkerStock } from "@msl/db";
import { Hono } from "hono";

import { organizationFilter, resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import {
	requireAdmin,
	requireRole,
	UserRole,
} from "@/middleware/authorization.middleware";
import { dateRangeQuerySchema } from "@/schemas/report.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Helper function to get date range
function getDateRange(period: string, startDate?: string, endDate?: string) {
	const now = new Date();
	let start: Date;
	const end: Date = endDate ? new Date(endDate) : now;

	if (startDate) {
		start = new Date(startDate);
	} else {
		switch (period) {
			case "today":
				start = new Date(now.setHours(0, 0, 0, 0));
				break;
			case "week":
				start = new Date(now.setDate(now.getDate() - 7));
				break;
			case "month":
				start = new Date(now.setMonth(now.getMonth() - 1));
				break;
			case "year":
				start = new Date(now.setFullYear(now.getFullYear() - 1));
				break;
			case "all":
				start = new Date(0); // Beginning of time
				break;
			default:
				start = new Date(now.setMonth(now.getMonth() - 1));
		}
	}

	return { start, end };
}

// Sales Summary Report (ADMIN)
app.get(
	"/sales-summary",
	requireAuth,
	requireAdmin,
	zValidator("query", dateRangeQuerySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		const { start, end } = getDateRange(
			query.period,
			query.startDate,
			query.endDate,
		);

		const dateFilter = {
			createdAt: { $gte: start, $lte: end },
		};

		// Aggregate sales data
		const [salesStats, paymentStats, topProducts] = await Promise.all([
			Sale.aggregate([
				{
					$match: {
						orgId: orgFilter,
						status: { $ne: "CANCELLED" },
						...dateFilter,
					},
				},
				{
					$group: {
						_id: null,
						totalSales: { $sum: 1 },
						totalRevenue: { $sum: "$total" },
						totalDiscount: { $sum: "$discount" },
						totalPaid: { $sum: "$paidAmount" },
						totalPending: { $sum: "$pendingAmount" },
					},
				},
			]),
			Payment.aggregate([
				{
					$match: {
						orgId: orgFilter,
						...dateFilter,
					},
				},
				{
					$group: {
						_id: "$paymentMethod",
						total: { $sum: "$amount" },
						count: { $sum: 1 },
					},
				},
			]),
			Sale.aggregate([
				{
					$match: {
						orgId: orgFilter,
						status: { $ne: "CANCELLED" },
						...dateFilter,
					},
				},
				{
					$lookup: {
						from: "saleitems",
						localField: "_id",
						foreignField: "saleId",
						as: "items",
					},
				},
				{ $unwind: "$items" },
				{
					$group: {
						_id: "$items.productId",
						totalQuantity: { $sum: "$items.quantity" },
						totalRevenue: { $sum: "$items.total" },
						salesCount: { $sum: 1 },
					},
				},
				{ $sort: { totalRevenue: -1 } },
				{ $limit: 10 },
				{
					$lookup: {
						from: "products",
						localField: "_id",
						foreignField: "_id",
						as: "product",
					},
				},
				{ $unwind: "$product" },
			]),
		]);

		const summary = salesStats[0] || {
			totalSales: 0,
			totalRevenue: 0,
			totalDiscount: 0,
			totalPaid: 0,
			totalPending: 0,
		};

		return c.json({
			period: query.period,
			startDate: start.toISOString(),
			endDate: end.toISOString(),
			summary,
			paymentBreakdown: paymentStats,
			topProducts: topProducts.map((item) => ({
				productId: item._id,
				productName: item.product.name,
				sku: item.product.sku,
				totalQuantity: item.totalQuantity,
				totalRevenue: item.totalRevenue,
				salesCount: item.salesCount,
			})),
		});
	},
);

// Worker Performance Report (ADMIN)
app.get(
	"/worker-performance",
	requireAuth,
	requireAdmin,
	zValidator("query", dateRangeQuerySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		const { start, end } = getDateRange(
			query.period,
			query.startDate,
			query.endDate,
		);

		const workerPerformance = await Sale.aggregate([
			{
				$match: {
					orgId: orgFilter,
					status: { $ne: "CANCELLED" },
					createdAt: { $gte: start, $lte: end },
				},
			},
			{
				$group: {
					_id: "$workerId",
					totalSales: { $sum: 1 },
					totalRevenue: { $sum: "$total" },
					totalPaid: { $sum: "$paidAmount" },
					totalPending: { $sum: "$pendingAmount" },
					avgSaleValue: { $avg: "$total" },
				},
			},
			{ $sort: { totalRevenue: -1 } },
		]);

		return c.json({
			period: query.period,
			startDate: start.toISOString(),
			endDate: end.toISOString(),
			workers: workerPerformance.map((worker) => ({
				workerId: worker._id,
				totalSales: worker.totalSales,
				totalRevenue: worker.totalRevenue,
				totalPaid: worker.totalPaid,
				totalPending: worker.totalPending,
				avgSaleValue: Math.round(worker.avgSaleValue),
				collectionRate:
					worker.totalRevenue > 0
						? Math.round((worker.totalPaid / worker.totalRevenue) * 100)
						: 0,
			})),
		});
	},
);

// Product Sales Report (ADMIN)
app.get(
	"/product-sales",
	requireAuth,
	requireAdmin,
	zValidator("query", dateRangeQuerySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const query = c.req.valid("query");

		const { start, end } = getDateRange(
			query.period,
			query.startDate,
			query.endDate,
		);

		const productSales = await Sale.aggregate([
			{
				$match: {
					orgId: orgFilter,
					status: { $ne: "CANCELLED" },
					createdAt: { $gte: start, $lte: end },
				},
			},
			{
				$lookup: {
					from: "saleitems",
					localField: "_id",
					foreignField: "saleId",
					as: "items",
				},
			},
			{ $unwind: "$items" },
			{
				$group: {
					_id: "$items.productId",
					totalQuantity: { $sum: "$items.quantity" },
					totalCases: { $sum: "$items.cases" },
					totalUnits: { $sum: "$items.units" },
					totalRevenue: { $sum: "$items.total" },
					salesCount: { $sum: 1 },
					avgPrice: { $avg: "$items.price" },
				},
			},
			{ $sort: { totalRevenue: -1 } },
			{
				$lookup: {
					from: "products",
					localField: "_id",
					foreignField: "_id",
					as: "product",
				},
			},
			{ $unwind: "$product" },
		]);

		return c.json({
			period: query.period,
			startDate: start.toISOString(),
			endDate: end.toISOString(),
			products: productSales.map((item) => ({
				productId: item._id,
				productName: item.product.name,
				sku: item.product.sku,
				unit: item.product.unit,
				totalQuantity: item.totalQuantity,
				totalCases: item.totalCases,
				totalUnits: item.totalUnits,
				totalRevenue: item.totalRevenue,
				salesCount: item.salesCount,
				avgPrice: Math.round(item.avgPrice),
			})),
		});
	},
);

// Pending Payments Report (ADMIN/WORKER)
app.get(
	"/pending-payments",
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

		// Workers can only see their own pending payments
		if (user.role === UserRole.WORKER) {
			filter.workerId = user.id;
		}

		const pendingSales = await Sale.aggregate([
			{ $match: filter },
			{
				$lookup: {
					from: "customers",
					localField: "customerId",
					foreignField: "_id",
					as: "customer",
				},
			},
			{ $unwind: "$customer" },
			{
				$group: {
					_id: "$paymentStatus",
					count: { $sum: 1 },
					totalPending: { $sum: "$pendingAmount" },
					sales: {
						$push: {
							saleId: "$_id",
							invoiceNo: "$invoiceNo",
							customerName: "$customer.name",
							customerPhone: "$customer.phone",
							total: "$total",
							paidAmount: "$paidAmount",
							pendingAmount: "$pendingAmount",
							createdAt: "$createdAt",
						},
					},
				},
			},
			{ $sort: { _id: 1 } },
		]);

		const summary = pendingSales.reduce(
			(acc, item) => {
				acc.totalCount += item.count;
				acc.totalPending += item.totalPending;
				if (item._id === "PENDING") {
					acc.fullyPending = item.count;
				} else if (item._id === "PARTIAL") {
					acc.partiallyPaid = item.count;
				}
				return acc;
			},
			{ totalCount: 0, totalPending: 0, fullyPending: 0, partiallyPaid: 0 },
		);

		return c.json({
			summary,
			breakdown: pendingSales,
		});
	},
);

// Stock Summary Report (ADMIN)
app.get("/stock-summary", requireAuth, requireAdmin, async (c) => {
	const organizationId = await resolveOrganizationId(c);
	const orgFilter = organizationFilter(organizationId);

	// Get warehouse stock
	const warehouseStock = await Product.find({
		orgId: orgFilter,
		isActive: true,
	}).select("_id name sku stock unitsPerCase minimumStock unit");

	// Get worker stock
	const workerStock = await WorkerStock.aggregate([
		{
			$match: {
				orgId: orgFilter,
				quantity: { $gt: 0 },
			},
		},
		{
			$group: {
				_id: "$productId",
				totalWorkerStock: { $sum: "$quantity" },
				workersCount: { $sum: 1 },
			},
		},
	]);

	const workerStockMap = new Map(workerStock.map((item) => [item._id, item]));

	const summary = warehouseStock.map((product) => {
		const stockInCases = Math.floor(product.stock / product.unitsPerCase);
		const remainingUnits = product.stock % product.unitsPerCase;
		const minimumStockInUnits = product.minimumStock * product.unitsPerCase;
		const isLowStock = product.stock <= minimumStockInUnits;

		const workerStockInfo = workerStockMap.get(product._id);
		const totalWorkerStock = workerStockInfo?.totalWorkerStock || 0;
		const totalStock = product.stock + totalWorkerStock;

		return {
			productId: product._id,
			name: product.name,
			sku: product.sku,
			unit: product.unit,
			warehouseStock: product.stock,
			warehouseStockInCases: stockInCases,
			warehouseRemainingUnits: remainingUnits,
			workerStock: totalWorkerStock,
			totalStock,
			minimumStock: product.minimumStock,
			isLowStock,
			workersWithStock: workerStockInfo?.workersCount || 0,
		};
	});

	const overallSummary = {
		totalProducts: summary.length,
		lowStockProducts: summary.filter((p) => p.isLowStock).length,
		outOfStockProducts: summary.filter((p) => p.totalStock === 0).length,
		totalWarehouseStock: summary.reduce((sum, p) => sum + p.warehouseStock, 0),
		totalWorkerStock: summary.reduce((sum, p) => sum + p.workerStock, 0),
	};

	return c.json({
		summary: overallSummary,
		products: summary,
	});
});

export default app;
