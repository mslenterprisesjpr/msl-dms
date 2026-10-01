import { zValidator } from "@hono/zod-validator";
import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Customer } from "@msl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { organizationFilter, resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import {
	requireAdmin,
	requireRole,
	UserRole,
} from "@/middleware/authorization.middleware";
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

// Get all customers with search and pagination (ADMIN/WORKER)
app.get(
	"/",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
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

// Search customers by name or phone (ADMIN/WORKER)
app.get(
	"/search",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
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
			],
		})
			.limit(20)
			.sort({ name: 1 });

		return c.json({ message: "Customers found", data: customers });
	},
);

// Get single customer (ADMIN/WORKER)
app.get(
	"/:id",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
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

// Create customer (ADMIN/WORKER)
app.post(
	"/",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
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

// Update customer (ADMIN/WORKER)
app.put(
	"/:id",
	requireAuth,
	requireRole(UserRole.ADMIN, UserRole.WORKER),
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
