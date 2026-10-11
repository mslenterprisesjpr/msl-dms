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
			let org = await db.collection("organization").findOne({
				id: headerOrgId,
			});

			console.log("🏢 Organization:", org ? "found" : "not found");

			// If organization doesn't exist in DB, create it
			// This happens when Better Auth creates org but doesn't sync to MongoDB
			if (!org) {
				console.log("⚠️ Organization missing in DB, creating it...");

				const newOrg = {
					id: headerOrgId,
					name: "My Organization", // Default name
					slug: `org-${Date.now()}`,
					createdBy: user.id,
					creatorId: user.id,
					ownerId: user.id,
					createdAt: new Date(),
					updatedAt: new Date(),
				};

				try {
					await db.collection("organization").insertOne(newOrg as any);
					org = newOrg as any;
					console.log("✅ Organization created in DB");
				} catch (error: any) {
					console.error("❌ Failed to create organization:", error.message);
				}
			}

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

				// Auto-join user as owner/member
				const { generateId } = await import("@msl/id");
				const role = isCreator ? "owner" : "member";

				try {
					await db.collection("member").insertOne({
						id: generateId(),
						organizationId: headerOrgId,
						userId: user.id,
						role: role,
						createdAt: new Date(),
					} as any);

					console.log(`✅ Auto-joined user as ${role}`);
					return headerOrgId;
				} catch (error: any) {
					console.error("❌ Failed to create membership:", error.message);
				}
			}

			// Debug: show database state
			const allOrgs = await db
				.collection("organization")
				.find({})
				.limit(10)
				.toArray();
			const allMembers = await db
				.collection("member")
				.find({})
				.limit(10)
				.toArray();

			console.log("📊 Database state:", {
				totalOrgs: allOrgs.length,
				totalMembers: allMembers.length,
			});

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
