import type { AppSession as Session, AppUser as User } from "@msl/auth";
import {
	Customer,
	Order,
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

	const [totalProducts, totalCustomers, pendingOrders, revenueResult] =
		await Promise.all([
			Product.countDocuments({ orgId: orgFilter, isActive: true }),
			Customer.countDocuments({ orgId: orgFilter, isActive: true }),
			Order.countDocuments({ orgId: orgFilter, status: "PENDING" }),
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
						totalRevenue: { $sum: "$total" },
					},
				},
			]),
		]);

	const monthlyRevenue = revenueResult[0]?.totalRevenue || 0;

	return c.json({
		totalProducts,
		totalCustomers,
		pendingOrders,
		monthlyRevenue,
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
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		);

		const [totalStockItems, issuedToday, returnsToday, lowStockItems] =
			await Promise.all([
				WorkerStock.countDocuments({ orgId: orgFilter, workerId }),
				StockTransaction.countDocuments({
					orgId: orgFilter,
					workerId,
					type: "ISSUE",
					createdAt: { $gte: startOfToday },
				}),
				StockTransaction.countDocuments({
					orgId: orgFilter,
					workerId,
					type: "RETURN",
					createdAt: { $gte: startOfToday },
				}),
				WorkerStock.countDocuments({
					orgId: orgFilter,
					workerId,
					quantity: { $lte: 5 },
				}),
			]);

		return c.json({
			totalStockItems,
			issuedToday,
			returnsToday,
			lowStockItems,
		});
	},
);

export default app;
