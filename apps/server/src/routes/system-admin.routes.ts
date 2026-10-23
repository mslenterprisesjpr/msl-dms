import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Customer, Order, Product, Sale, StockTransaction } from "@msl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ObjectId } from "mongodb";

import { requireAuth } from "@/middleware/authentication.middleware";
import { requireRole, SystemRole } from "@/middleware/authorization.middleware";
import { db } from "@/services";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// All routes in this file strictly require System Super Admin (user.role === 'admin')
app.use("*", requireAuth, requireRole(SystemRole.ADMIN));

/**
 * GET /stats
 * Platform-wide super admin KPI metrics
 */
app.get("/stats", async (c) => {
	const [totalOrgs, totalUsers, salesAggregate, distinctActiveOrgs] =
		await Promise.all([
			db.collection("organization").countDocuments(),
			db.collection("user").countDocuments(),
			Sale.aggregate([
				{ $match: { status: { $ne: "CANCELLED" } } },
				{
					$group: {
						_id: null,
						totalRevenue: { $sum: "$total" },
						totalBills: { $sum: 1 },
					},
				},
			]),
			db.collection("member").distinct("organizationId"),
		]);

	const totalRevenue = salesAggregate[0]?.totalRevenue || 0;
	const totalBills = salesAggregate[0]?.totalBills || 0;

	return c.json({
		success: true,
		totalOrganizations: totalOrgs,
		activeOrganizations: distinctActiveOrgs.length,
		totalUsers,
		totalRevenue,
		totalBills,
		systemStatus: "OPTIMAL",
		uptimeSeconds: Math.floor(process.uptime()),
		timestamp: new Date().toISOString(),
	});
});

/**
 * GET /organizations
 * List all tenant organizations with member counts & metadata
 */
app.get("/organizations", async (c) => {
	const query = c.req.query("search")?.trim().toLowerCase();

	const filter: any = {};
	if (query) {
		filter.$or = [
			{ name: { $regex: query, $options: "i" } },
			{ slug: { $regex: query, $options: "i" } },
		];
	}

	const orgs = await db
		.collection("organization")
		.find(filter)
		.sort({ createdAt: -1 })
		.limit(100)
		.toArray();

	// Enrich with member counts and owner info
	const enrichedOrgs = await Promise.all(
		orgs.map(async (org) => {
			const orgIdStr = org._id ? org._id.toString() : org.id;

			const [memberCount, members] = await Promise.all([
				db.collection("member").countDocuments({
					organizationId: { $in: [orgIdStr, org.id, org._id] },
				}),
				db
					.collection("member")
					.find({
						organizationId: { $in: [orgIdStr, org.id, org._id] },
					})
					.limit(5)
					.toArray(),
			]);

			return {
				id: orgIdStr,
				_id: orgIdStr,
				name: org.name,
				slug: org.slug,
				logo: org.logo || null,
				metadata: org.metadata || {},
				createdAt: org.createdAt,
				memberCount,
				sampleMembers: members.map((m) => ({
					userId: m.userId,
					role: m.role,
				})),
			};
		}),
	);

	return c.json({
		success: true,
		count: enrichedOrgs.length,
		data: enrichedOrgs,
	});
});

/**
 * GET /users
 * List all registered platform users with system roles and organization memberships
 */
app.get("/users", async (c) => {
	const search = c.req.query("search")?.trim();

	const filter: any = {};
	if (search) {
		filter.$or = [
			{ name: { $regex: search, $options: "i" } },
			{ email: { $regex: search, $options: "i" } },
		];
	}

	const users = await db
		.collection("user")
		.find(filter)
		.sort({ createdAt: -1 })
		.limit(100)
		.toArray();

	// Enrich each user with their organization memberships
	const enrichedUsers = await Promise.all(
		users.map(async (u) => {
			const userIdStr = u._id ? u._id.toString() : u.id;

			const memberships = await db
				.collection("member")
				.find({ userId: { $in: [userIdStr, u.id] } })
				.toArray();

			// Lookup org names
			const orgIds = memberships.map((m) => m.organizationId);
			const orgs = await db
				.collection("organization")
				.find({
					$or: [
						{ id: { $in: orgIds } },
						{
							_id: {
								$in: orgIds
									.filter((id: string) => ObjectId.isValid(id))
									.map((id: string) => new ObjectId(id)),
							},
						},
					],
				})
				.toArray();

			const orgMap = new Map<string, string>();
			for (const org of orgs) {
				const oid = org._id ? org._id.toString() : org.id;
				orgMap.set(oid, org.name);
				if (org.id) orgMap.set(org.id, org.name);
			}

			return {
				id: userIdStr,
				_id: userIdStr,
				name: u.name || "Unnamed User",
				email: u.email,
				role: u.role || "user",
				emailVerified: !!u.emailVerified,
				createdAt: u.createdAt,
				organizations: memberships.map((m) => ({
					organizationId: m.organizationId,
					organizationName: orgMap.get(m.organizationId) || "Organization",
					role: m.role,
				})),
			};
		}),
	);

	return c.json({
		success: true,
		count: enrichedUsers.length,
		data: enrichedUsers,
	});
});

/**
 * PATCH /users/:id/role
 * Promote or demote a user's system-level role ('admin' or 'user')
 */
app.patch("/users/:id/role", async (c) => {
	const currentUser = c.get("user") as User;
	const targetUserId = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));
	const { role } = body as { role: string };

	if (role !== "admin" && role !== "user") {
		throw new HTTPException(400, {
			message: "Invalid role. Allowed values: 'admin' or 'user'",
		});
	}

	// Prevent self-demotion
	if (targetUserId === currentUser.id && role !== "admin") {
		throw new HTTPException(400, {
			message: "Cannot demote your own Super Admin account",
		});
	}

	const filter: any = ObjectId.isValid(targetUserId)
		? { $or: [{ _id: new ObjectId(targetUserId) }, { id: targetUserId }] }
		: { id: targetUserId };

	const updateResult = await db.collection("user").updateOne(filter, {
		$set: {
			role,
			updatedAt: new Date(),
		},
	});

	if (updateResult.matchedCount === 0) {
		throw new HTTPException(404, { message: "User not found" });
	}

	return c.json({
		success: true,
		message: `User system role updated to ${role}`,
		userId: targetUserId,
		role,
	});
});

/**
 * GET /telemetry
 * System health, MongoDB stats, and process runtime telemetry
 */
app.get("/telemetry", async (c) => {
	const memory = process.memoryUsage();

	const [
		totalUsers,
		totalOrgs,
		totalProducts,
		totalCustomers,
		totalSales,
		totalOrders,
		totalTransactions,
	] = await Promise.all([
		db.collection("user").countDocuments(),
		db.collection("organization").countDocuments(),
		Product.countDocuments(),
		Customer.countDocuments(),
		Sale.countDocuments(),
		Order.countDocuments(),
		StockTransaction.countDocuments(),
	]);

	const uptimeSec = Math.floor(process.uptime());
	const hours = Math.floor(uptimeSec / 3600);
	const minutes = Math.floor((uptimeSec % 3600) / 60);
	const seconds = uptimeSec % 60;

	return c.json({
		success: true,
		health: "OPTIMAL",
		database: "CONNECTED",
		nodeVersion: process.version,
		uptime: `${hours}h ${minutes}m ${seconds}s`,
		uptimeSeconds: uptimeSec,
		memory: {
			heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
			heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
			rssMB: Math.round(memory.rss / 1024 / 1024),
		},
		collectionCounts: {
			users: totalUsers,
			organizations: totalOrgs,
			products: totalProducts,
			customers: totalCustomers,
			sales: totalSales,
			orders: totalOrders,
			stockTransactions: totalTransactions,
		},
		timestamp: new Date().toISOString(),
	});
});

export default app;
