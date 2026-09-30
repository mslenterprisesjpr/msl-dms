import { zValidator } from "@hono/zod-validator";
import { WorkerStock } from "@msl/db";
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
	getWorkerProductStockParamsSchema,
	getWorkerStockParamsSchema,
} from "@/schemas/worker-stock.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Get all workers' stock - Admin only overview
app.get("/all", requireAuth, requireAdmin, async (c) => {
	const organizationId = await resolveOrganizationId(c);
	const orgFilter = organizationFilter(organizationId);

	const workerStocks = await WorkerStock.find({
		orgId: orgFilter,
		quantity: { $gt: 0 }, // Only show non-zero stocks
	})
		.populate("productId", "name sku unitsPerCase unit")
		.sort({ workerId: 1, createdAt: -1 });

	// Group by worker
	const groupedByWorker = workerStocks.reduce((acc: any, stock: any) => {
		const workerId = stock.workerId;

		if (!acc[workerId]) {
			acc[workerId] = {
				workerId,
				products: [],
				totalItems: 0,
			};
		}

		const product = stock.productId;
		const stockInCases = Math.floor(stock.quantity / product.unitsPerCase);
		const remainingUnits = stock.quantity % product.unitsPerCase;

		acc[workerId].products.push({
			productId: product._id,
			productName: product.name,
			sku: product.sku,
			quantity: stock.quantity,
			stockInCases,
			remainingUnits,
			unit: product.unit,
			unitsPerCase: product.unitsPerCase,
		});

		acc[workerId].totalItems += 1;

		return acc;
	}, {});

	const data = Object.values(groupedByWorker);

	return c.json({
		data,
		totalWorkers: data.length,
	});
});

// Get specific worker's stock (Admin can see any, Worker can see only own)
app.get(
	"/:workerId",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getWorkerStockParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { workerId } = c.req.valid("param");

		// Workers can only view their own stock
		if (user.role === UserRole.WORKER && user.id !== workerId) {
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
			workerId,
			data: products,
			totalProducts: products.length,
			totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
		});
	},
);

// Get specific product stock for a worker (Admin can see any, Worker can see only own)
app.get(
	"/:workerId/:productId",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
	zValidator("param", getWorkerProductStockParamsSchema),
	async (c) => {
		const user = c.get("user") as User;
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { workerId, productId } = c.req.valid("param");

		// Workers can only view their own stock
		if (user.role === UserRole.WORKER && user.id !== workerId) {
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
