import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

type User = {
	id: string;
	role?: string;
	[key: string]: unknown;
};

/**
 * System-level user roles (stored in user table)
 * These control global system access
 */
export enum SystemRole {
	ADMIN = "admin", // System manager - can do everything
	USER = "user", // Normal user - can work with their orgs
}

/**
 * User roles for route-level authorization
 * These are used in route middleware for permission checks
 */
export enum UserRole {
	ADMIN = "admin", // System Admin OR Org Admin/Owner
	USER = "user", // Normal user
}

/**
 * Organization-level roles (Better Auth organization plugin)
 * These control per-organization permissions
 */
export enum OrganizationRole {
	OWNER = "owner", // Created the org - full control
	ADMIN = "admin", // Org administrator - manage members & settings
	MEMBER = "member", // Regular member - work on tasks
}

/**
 * Check if user has required system role
 */
export function requireRole(...allowedRoles: SystemRole[]) {
	return async (c: Context, next: () => Promise<void>) => {
		const user = c.get("user") as User | null;

		if (!user) {
			throw new HTTPException(401, { message: "Unauthorized - No user found" });
		}

		const userRole = (user.role as SystemRole) || SystemRole.USER;

		if (!allowedRoles.includes(userRole)) {
			throw new HTTPException(403, {
				message: `Forbidden - Required role: ${allowedRoles.join(" or ")}`,
			});
		}

		await next();
	};
}

/**
 * Require admin access (System Admin OR Organization Admin/Owner)
 *
 * Allows:
 * 1. System Admin (user.role === "admin") - God mode
 * 2. Organization Admin (Better Auth member.role === "admin")
 * 3. Organization Owner (Better Auth member.role === "owner")
 */
export async function requireAdmin(c: Context, next: () => Promise<void>) {
	const user = c.get("user") as User | null;

	if (!user) {
		throw new HTTPException(401, { message: "Unauthorized - No user found" });
	}

	// System Admin - full access
	if (user.role === SystemRole.ADMIN) {
		return next();
	}

	// Check Organization Admin/Owner role
	const session = c.get("session") as any;
	const orgId =
		c.req.header("x-organization-id")?.trim() || session?.activeOrganizationId;

	if (!orgId) {
		throw new HTTPException(403, {
			message:
				"No organization context. Admin operations require organization selection.",
		});
	}

	// Query Better Auth member table for org-level role
	const { db } = await import("@/services");
	const member = await db.collection("member").findOne({
		organizationId: orgId,
		userId: user.id,
	});

	if (!member) {
		throw new HTTPException(403, {
			message: "You are not a member of this organization",
		});
	}

	// Allow if Organization Admin or Owner
	if (member.role === "admin" || member.role === "owner") {
		return next();
	}

	throw new HTTPException(403, {
		message: "Forbidden - Admin or Owner role required within organization",
	});
}

/**
 * Check if user is system admin
 */
export function isAdmin(user: User | null): boolean {
	return user?.role === SystemRole.ADMIN;
}

/**
 * Check if user is organization admin or owner
 */
export async function isOrgAdmin(
	userId: string,
	organizationId: string,
): Promise<boolean> {
	const { db } = await import("@/services");
	const member = await db.collection("member").findOne({
		organizationId,
		userId,
	});
	return member?.role === "admin" || member?.role === "owner";
}

/**
 * Validate organization role value
 */
export function isValidOrganizationRole(
	role: string,
): role is OrganizationRole {
	return Object.values(OrganizationRole).includes(role as OrganizationRole);
}

/**
 * Check if user is the resource creator/owner (by user ID)
 */
export function isResourceOwner(
	user: User | null,
	resourceUserId: string,
): boolean {
	return user?.id === resourceUserId;
}

/**
 * Check if user can access resource (system admin or creator)
 */
export function canAccessResource(
	user: User | null,
	resourceUserId: string,
): boolean {
	return isAdmin(user) || isResourceOwner(user, resourceUserId);
}
