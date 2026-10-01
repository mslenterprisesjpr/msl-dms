import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Product } from "@msl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { organizationFilter, resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import { requireAdmin } from "@/middleware/authorization.middleware";
import {
	createProductBodySchema,
	getProductParamsSchema,
	getProductsQuerySchema,
	updateProductBodySchema,
} from "@/schemas/product.schema";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

// Get all products with filtering and pagination
app.get(
	"/",
	requireAuth,
	zValidator("query", getProductsQuerySchema),
	async (c) => {
		const query = c.req.valid("query");

		// Resolve organization ID (from header or session)
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);

		// Build filter - always filter by orgId
		const filter: any = { orgId: orgFilter };

		if (query.category) {
			filter.category = query.category;
		}

		if (query.search) {
			filter.$or = [
				{ name: { $regex: query.search, $options: "i" } },
				{ sku: { $regex: query.search, $options: "i" } },
			];
		}

		if (query.minPrice || query.maxPrice) {
			filter.sellingRate = {};
			if (query.minPrice) filter.sellingRate.$gte = query.minPrice;
			if (query.maxPrice) filter.sellingRate.$lte = query.maxPrice;
		}

		if (query.isActive !== undefined) {
			filter.isActive = query.isActive;
		}

		// Sort option
		let sortOption: any = { createdAt: -1 };
		if (query.sort === "name") sortOption = { name: 1 };
		if (query.sort === "price_asc") sortOption = { sellingRate: 1 };
		if (query.sort === "price_desc") sortOption = { sellingRate: -1 };
		if (query.sort === "stock") sortOption = { stock: -1 };

		const skip = (query.page - 1) * query.limit;

		const [products, total] = await Promise.all([
			Product.find(filter).sort(sortOption).skip(skip).limit(query.limit),
			Product.countDocuments(filter),
		]);

		return c.json({
			data: products,
			pagination: {
				total,
				page: query.page,
				limit: query.limit,
				pages: Math.ceil(total / query.limit),
			},
		});
	},
);

// Get low stock products
app.get("/low-stock", requireAuth, async (c) => {
	const organizationId = await resolveOrganizationId(c);
	const orgFilter = organizationFilter(organizationId);

	const products = await Product.aggregate([
		{
			$match: {
				orgId: orgFilter,
				isActive: true,
			},
		},
		{
			$addFields: {
				stockInCases: {
					$floor: { $divide: ["$stock", "$unitsPerCase"] },
				},
			},
		},
		{
			$match: {
				$expr: {
					$lte: ["$stockInCases", "$minimumStock"],
				},
			},
		},
		{
			$sort: { stock: 1 },
		},
	]);

	return c.json({ data: products });
});

// Get single product
app.get(
	"/:id",
	requireAuth,
	zValidator("param", getProductParamsSchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		const product = await Product.findOne({ _id: id, orgId: orgFilter });

		if (!product) {
			throw new HTTPException(404, { message: "Product not found" });
		}

		return c.json(product);
	},
);

// Create product (Admin only)
app.post(
	"/",
	requireAuth,
	requireAdmin,
	zValidator("json", createProductBodySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const body = c.req.valid("json");

		// Check if SKU already exists in this organization
		const existingProduct = await Product.findOne({
			orgId: organizationId,
			sku: body.sku,
		});

		if (existingProduct) {
			throw new HTTPException(400, {
				message: "Product with this SKU already exists",
			});
		}

		const product = await Product.create({
			...body,
			orgId: organizationId,
		});

		return c.json(product, 201);
	},
);

// Update product (Admin only)
app.put(
	"/:id",
	requireAuth,
	requireAdmin,
	zValidator("param", getProductParamsSchema),
	zValidator("json", updateProductBodySchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");

		// Check if product exists and belongs to user's org
		const existingProduct = await Product.findOne({
			_id: id,
			orgId: orgFilter,
		});

		if (!existingProduct) {
			throw new HTTPException(404, { message: "Product not found" });
		}

		// If SKU is being updated, check for duplicates
		if (body.sku && body.sku !== existingProduct.sku) {
			const duplicateSKU = await Product.findOne({
				orgId: orgFilter,
				sku: body.sku,
				_id: { $ne: id },
			});

			if (duplicateSKU) {
				throw new HTTPException(400, {
					message: "Product with this SKU already exists",
				});
			}
		}

		const product = await Product.findByIdAndUpdate(
			id,
			{ ...body },
			{ new: true },
		);

		return c.json(product);
	},
);

// Delete product (Admin only) - Soft delete
app.delete(
	"/:id",
	requireAuth,
	requireAdmin,
	zValidator("param", getProductParamsSchema),
	async (c) => {
		const organizationId = await resolveOrganizationId(c);
		const orgFilter = organizationFilter(organizationId);
		const { id } = c.req.valid("param");

		// Check if product exists and belongs to user's org
		const product = await Product.findOne({ _id: id, orgId: orgFilter });

		if (!product) {
			throw new HTTPException(404, { message: "Product not found" });
		}

		// Soft delete - just mark as inactive
		await Product.findByIdAndUpdate(id, { isActive: false });

		return c.json({ message: "Product deleted successfully" });
	},
);

export default app;
