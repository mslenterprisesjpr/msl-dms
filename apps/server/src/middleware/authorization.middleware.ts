import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * User type from better-auth
 * Note: orgId is NOT stored in user object by default
 * Use resolveOrganizationId() from lib/org-context.ts instead
 */
type User = {
	id: string;
	role?: string;
	[key: string]: unknown;
};

/**
 * User roles for authorization
 */
export enum UserRole {
	ADMIN = "admin",
	USER = "user",
	WORKER = "worker",
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...allowedRoles: UserRole[]) {
	return async (c: Context, next: () => Promise<void>) => {
		const user = c.get("user") as User | null;

		if (!user) {
			throw new HTTPException(401, { message: "Unauthorized - No user found" });
		}

		const userRole = (user.role as UserRole) || UserRole.USER;

		if (!allowedRoles.includes(userRole)) {
			throw new HTTPException(403, {
				message: `Forbidden - Required role: ${allowedRoles.join(" or ")}`,
			});
		}

		await next();
	};
}

/**
 * Admin-only middleware
 */
export async function requireAdmin(c: Context, next: () => Promise<void>) {
	return requireRole(UserRole.ADMIN)(c, next);
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
	return user?.role === UserRole.ADMIN;
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
 * Check if user can access resource (admin or creator)
 */
export function canAccessResource(
	user: User | null,
	resourceUserId: string,
): boolean {
	return isAdmin(user) || isResourceOwner(user, resourceUserId);
}
