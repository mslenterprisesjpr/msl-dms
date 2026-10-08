import type { AppSession as Session, AppUser as User } from "@msl/auth";
import {
	Customer,
	Order,
	Payment,
	Product,
	Sale,
	StockTransaction,
	WorkerStock,
} from "@msl/db";
import { Hono } from "hono";

import { organizationFilter, resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import {
	requireAdmin,
	requireRole,
	UserRole,
} from "@/middleware/authorization.middleware";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// GET /admin-stats - Admin overview statistics
app.get("/admin-stats", requireAuth, requireAdmin, async (c) => {
	const organizationId = await resolveOrganizationId(c);
	const orgFilter = organizationFilter(organizationId);

	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);

	const [
		totalProducts,
		totalCustomers,
		pendingOrders,
		lowStockCount,
		monthlyRevenueResult,
		todaySalesResult,
		outstandingResult,
		todayCollectionResult,
	] = await Promise.all([
		Product.countDocuments({ orgId: orgFilter, isActive: true }),
		Customer.countDocuments({ orgId: orgFilter, isActive: true }),
		Order.countDocuments({ orgId: orgFilter, status: "PENDING" }),
		Product.countDocuments({
			orgId: orgFilter,
			isActive: true,
			$expr: { $lte: ["$stock", "$minimumStock"] },
		}),
		Sale.aggregate([
			{
				$match: {
					orgId: orgFilter,
					status: { $ne: "CANCELLED" },
					createdAt: { $gte: startOfMonth },
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: "$total" },
				},
			},
		]),
		Sale.aggregate([
			{
				$match: {
					orgId: orgFilter,
					status: { $ne: "CANCELLED" },
					createdAt: { $gte: startOfToday },
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: "$total" },
				},
			},
		]),
		Sale.aggregate([
			{
				$match: {
					orgId: orgFilter,
					status: { $ne: "CANCELLED" },
					pendingAmount: { $gt: 0 },
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: "$pendingAmount" },
				},
			},
		]),
		Payment.aggregate([
			{
				$match: {
					orgId: orgFilter,
					createdAt: { $gte: startOfToday },
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: "$amount" },
				},
			},
		]),
	]);

	const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
	const todaySales = todaySalesResult[0]?.total || 0;
	const totalOutstanding = outstandingResult[0]?.total || 0;
	const todayCollection = todayCollectionResult[0]?.total || 0;

	return c.json({
		totalProducts,
		totalCustomers,
		pendingOrders,
		lowStockCount,
		monthlyRevenue,
		todaySales,
		totalOutstanding,
		todayCollection,
	});
});

// GET /worker-stats - Worker personal statistics
app.get(
	"/worker-stats",
	requireAuth,
	requireRole(UserRole.WORKER, UserRole.ADMIN),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);

		// Admin can query specific worker stats, worker only views own stats
		const queryWorkerId = c.req.query("workerId");
		const workerId =
			queryWorkerId && user.role === UserRole.ADMIN ? queryWorkerId : user.id;

		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		);

		const [
			todaySalesResult,
			todayOrders,
			todayCollectionResult,
			monthlySalesResult,
			totalStockItems,
			totalUnitsResult,
			issuedTodayResult,
			lowStockItems,
		] = await Promise.all([
			Sale.aggregate([
				{
					$match: {
						orgId: orgFilter,
						workerId,
						status: { $ne: "CANCELLED" },
						createdAt: { $gte: startOfToday },
					},
				},
				{
					$group: {
						_id: null,
						total: { $sum: "$total" },
					},
				},
			]),
			Order.countDocuments({
				orgId: orgFilter,
				workerId,
				createdAt: { $gte: startOfToday },
			}),
			Payment.aggregate([
				{
					$match: {
						orgId: orgFilter,
						createdBy: workerId,
						createdAt: { $gte: startOfToday },
					},
				},
				{
					$group: {
						_id: null,
						total: { $sum: "$amount" },
					},
				},
			]),
			Sale.aggregate([
				{
					$match: {
						orgId: orgFilter,
						workerId,
						status: { $ne: "CANCELLED" },
						createdAt: { $gte: startOfMonth },
					},
				},
				{
					$group: {
						_id: null,
						total: { $sum: "$total" },
					},
				},
			]),
			WorkerStock.countDocuments({
				orgId: orgFilter,
				workerId,
				quantity: { $gt: 0 },
			}),
			WorkerStock.aggregate([
				{
					$match: {
						orgId: orgFilter,
						workerId,
					},
				},
				{
					$group: {
						_id: null,
						totalUnits: { $sum: "$quantity" },
					},
				},
			]),
			StockTransaction.aggregate([
				{
					$match: {
						orgId: orgFilter,
						workerId,
						type: "ISSUE",
						createdAt: { $gte: startOfToday },
					},
				},
				{
					$group: {
						_id: null,
						total: { $sum: "$quantity" },
					},
				},
			]),
			WorkerStock.countDocuments({
				orgId: orgFilter,
				workerId,
				quantity: { $gt: 0, $lte: 5 },
			}),
		]);

		const todaySales = todaySalesResult[0]?.total || 0;
		const todayCollection = todayCollectionResult[0]?.total || 0;
		const monthlySales = monthlySalesResult[0]?.total || 0;
		const totalUnitsInHand = totalUnitsResult[0]?.totalUnits || 0;
		const issuedToday = issuedTodayResult[0]?.total || 0;

		return c.json({
			todaySales,
			todayOrders,
			todayCollection,
			monthlySales,
			totalStockItems,
			totalUnitsInHand,
			issuedToday,
			lowStockItems,
		});
	},
);

export default app;
