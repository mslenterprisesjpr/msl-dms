import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Organization context helpers for multi-tenancy
 * Better Auth doesn't store orgId in user object by default
 * So we need to resolve it from organization membership
 */

/**
 * Resolve organization ID from user context
 * This should be customized based on your organization model
 *
 * For now, we'll assume orgId is stored in user metadata or a separate collection
 */
export async function resolveOrganizationId(c: Context): Promise<string> {
	const user = c.get("user") as any;

	if (!user) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	// Option 1: If orgId is stored in user metadata
	const orgId = user.orgId || user.organizationId;

	if (!orgId) {
		throw new HTTPException(403, {
			message: "No organization associated with this user",
		});
	}

	return String(orgId);
}

/**
 * Generate ID candidates for flexible matching
 * Useful when IDs might be stored in different formats
 */
export function idCandidates(id: string | undefined | null): string[] {
	if (!id) return [];
	const trimmed = id.trim();
	if (!trimmed) return [];
	return [trimmed];
}

/**
 * Organization filter for MongoDB queries
 * Handles single ID or multiple ID candidates
 */
export function organizationFilter(organizationId: string) {
	const candidates = idCandidates(organizationId);
	if (candidates.length === 1) {
		return candidates[0];
	}
	return { $in: candidates };
}

/**
 * Find all members of an organization
 * You'll need to implement this based on your organization/member model
 */
export async function findMembersByOrganizationId(
	_organizationId: string,
): Promise<Array<{ userId: string; role: string; _id: string }>> {
	// TODO: Implement based on your organization member model
	// For now, returning empty array
	// In real implementation, query your OrganizationMember collection
	return [];
}

/**
 * Check if user belongs to organization
 */
export async function userBelongsToOrganization(
	_userId: string,
	_organizationId: string,
): Promise<boolean> {
	// TODO: Implement based on your organization member model
	// For now, return true (you'll need to add proper check)
	return true;
}
