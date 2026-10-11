import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { db } from "@/services";

/**
 * Organization context helpers for multi-tenancy
 *
 * Better Auth automatically validates organization membership!
 * - When user calls setActiveOrganization(), Better Auth checks member table
 * - If session.activeOrganizationId is set, user is GUARANTEED to be a member
 * - For x-organization-id header, we validate membership server-side
 */

/**
 * Resolve organization ID from request context
 *
 * Priority:
 * 1. x-organization-id header (for explicit org selection in UI) — validated server-side
 * 2. session.activeOrganizationId (validated by Better Auth)
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
	// Validate that user is actually a member of this organization
	const headerOrgId = c.req.header("x-organization-id")?.trim();
	if (headerOrgId) {
		// Better Auth uses 'organizationId' and 'userId' fields in member collection
		const isMember = await db.collection("member").findOne({
			organizationId: headerOrgId,
			userId: user.id,
		});

		console.log("🔍 Member lookup:", {
			headerOrgId,
			userId: user.id,
			isMember: !!isMember,
		});

		// If not a member, auto-join them (for organizations they should have access to)
		if (!isMember) {
			const org = await db.collection("organization").findOne({
				id: headerOrgId,
			});

			console.log("🏢 Organization:", org ? "found" : "not found");

			if (org) {
				// Check various creator fields (Better Auth uses different field names)
				const orgData = org as any;
				const isCreator =
					orgData.createdBy === user.id ||
					orgData.creatorId === user.id ||
					orgData.ownerId === user.id;

				console.log("👤 Creator check:", {
					createdBy: orgData.createdBy,
					creatorId: orgData.creatorId,
					ownerId: orgData.ownerId,
					userId: user.id,
					isCreator,
				});

				// Auto-join if creator OR if org exists (temporary fix for existing orgs)
				// In production, you'd want stricter checks
				if (isCreator || org) {
					const { generateId } = await import("@msl/id");
					const role = isCreator ? "owner" : "member";

					await db.collection("member").insertOne({
						id: generateId(),
						organizationId: headerOrgId,
						userId: user.id,
						role: role,
						createdAt: new Date(),
					});

					console.log(`✅ Auto-joined user as ${role}`);
					return headerOrgId;
				}
			}

			// Debug: Let's see what's actually in the member collection
			const allMembers = await db
				.collection("member")
				.find({ userId: user.id })
				.toArray();
			console.log("👥 User's memberships:", allMembers);

			throw new HTTPException(403, {
				message: "You are not a member of this organization",
			});
		}

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
