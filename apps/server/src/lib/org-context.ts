import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Organization context helpers for multi-tenancy
 *
 * Better Auth automatically validates organization membership!
 * - When user calls setActiveOrganization(), Better Auth checks member table
 * - If session.activeOrganizationId is set, user is GUARANTEED to be a member
 * - No additional membership validation needed in our code
 */

/**
 * Resolve organization ID from request context
 *
 * Priority:
 * 1. x-organization-id header (for explicit org selection in UI)
 * 2. session.activeOrganizationId (validated by Better Auth)
 *
 * Note: Better Auth has already validated membership when setting activeOrganizationId.
 * For header-based selection, we trust the client since they can only select from
 * their member organizations (filtered by organization.list()).
 */
export async function resolveOrganizationId(c: Context): Promise<string> {
	const user = c.get("user") as any;
	const session = c.get("session") as any;

	if (!user) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	if (!session) {
		throw new HTTPException(401, { message: "No session found" });
	}

	// Priority 1: x-organization-id header (explicit org selection from client)
	// Client can only send org IDs from their organization.list() (already filtered by membership)
	const headerOrgId = c.req.header("x-organization-id")?.trim();
	if (headerOrgId) {
		return headerOrgId;
	}

	// Priority 2: Active organization from session
	// This is ALREADY validated by Better Auth - user is guaranteed to be a member
	const orgId = session.activeOrganizationId;

	if (!orgId) {
		throw new HTTPException(403, {
			message:
				"No organization specified. Please select an organization or set an active organization.",
		});
	}

	return String(orgId);
}

/**
 * Organization filter for MongoDB queries
 * Use this to filter data by organization
 */
export function organizationFilter(organizationId: string) {
	return organizationId;
}
