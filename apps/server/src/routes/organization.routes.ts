import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import { requireAdmin } from "@/middleware/authorization.middleware";
import { auth, db } from "@/services";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * POST /add-member
 * Directly adds a user to an organization without email invitations or verification hurdles.
 * If user exists by ID or email, addMember is invoked directly on the server.
 */
app.post("/add-member", requireAuth, requireAdmin, async (c) => {
	const body = await c.req.json().catch(() => ({}));
	let { organizationId, userId, email, role } = body as {
		organizationId?: string;
		userId?: string;
		email?: string;
		role?: string;
	};

	// Fallback to active org if not provided
	if (!organizationId) {
		const resolved = await resolveOrganizationId(c);
		if (resolved) {
			organizationId = resolved;
		}
	}

	if (!organizationId) {
		throw new HTTPException(400, {
			message: "Organization ID is required",
		});
	}

	const memberRole = (role || "member") as any;

	try {
		// Case 1: Direct userId provided
		if (userId) {
			const result = await auth.api.addMember({
				body: {
					userId,
					role: memberRole,
					organizationId,
				},
			});

			return c.json({
				success: true,
				message: "User added to organization directly as active member",
				memberAdded: true,
				data: result,
			});
		}

		// Case 2: Email provided
		if (email && email.trim()) {
			const cleanEmail = email.trim().toLowerCase();

			// Check if user already exists in DB
			const existingUser = await db.collection("user").findOne({
				email: cleanEmail,
			});

			if (existingUser) {
				const resolvedUserId = existingUser._id
					? existingUser._id.toString()
					: (existingUser.id as string);

				const result = await auth.api.addMember({
					body: {
						userId: resolvedUserId,
						role: memberRole,
						organizationId,
					},
				});

				return c.json({
					success: true,
					message: `${existingUser.name || cleanEmail} added directly to organization`,
					memberAdded: true,
					data: result,
				});
			}

			// User is not registered yet in the system: create invitation
			const invitation = await auth.api.createInvitation({
				body: {
					email: cleanEmail,
					role: memberRole,
					organizationId,
				},
				headers: c.req.raw.headers,
			});

			return c.json({
				success: true,
				message: `User is not registered yet. In-app invitation created for ${cleanEmail}`,
				memberAdded: false,
				invited: true,
				data: invitation,
			});
		}

		throw new HTTPException(400, {
			message: "Either userId or email must be provided",
		});
	} catch (error: any) {
		console.error("Add member error:", error);
		const message =
			error?.body?.message ||
			error?.message ||
			"Failed to add user to organization";
		return c.json(
			{
				success: false,
				message,
			},
			400,
		);
	}
});

/**
 * GET /user-invitations
 * Lists all pending invitations for the logged-in user with organization details.
 */
app.get("/user-invitations", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user || !user.email) {
		return c.json({ invitations: [] });
	}

	try {
		const invitations = await auth.api.listUserInvitations({
			query: {
				email: user.email,
			},
		});

		// Enrich each invitation with organization details if available
		const enriched = await Promise.all(
			(invitations || []).map(async (inv: any) => {
				const org = await db.collection("organization").findOne({
					$or: [{ _id: inv.organizationId }, { id: inv.organizationId }],
				});

				return {
					...inv,
					organizationName: org?.name || "Organization",
					organizationSlug: org?.slug || "",
					organizationLogo: org?.logo || null,
				};
			}),
		);

		return c.json({
			success: true,
			invitations: enriched,
		});
	} catch (error: any) {
		console.error("List user invitations error:", error);
		return c.json({
			success: false,
			invitations: [],
			message: error?.message || "Failed to fetch invitations",
		});
	}
});

/**
 * POST /accept-invitation
 * Accepts an invitation in-app directly without email link.
 */
app.post("/accept-invitation", requireAuth, async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const { invitationId } = body as { invitationId: string };

	if (!invitationId) {
		throw new HTTPException(400, { message: "Invitation ID is required" });
	}

	try {
		const result = await auth.api.acceptInvitation({
			body: { invitationId },
			headers: c.req.raw.headers,
		});

		return c.json({
			success: true,
			message: "Invitation accepted successfully",
			data: result,
		});
	} catch (error: any) {
		console.error("Accept invitation error:", error);
		const message =
			error?.body?.message || error?.message || "Failed to accept invitation";
		return c.json({ success: false, message }, 400);
	}
});

/**
 * POST /reject-invitation
 * Rejects an invitation in-app.
 */
app.post("/reject-invitation", requireAuth, async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const { invitationId } = body as { invitationId: string };

	if (!invitationId) {
		throw new HTTPException(400, { message: "Invitation ID is required" });
	}

	try {
		const result = await auth.api.rejectInvitation({
			body: { invitationId },
			headers: c.req.raw.headers,
		});

		return c.json({
			success: true,
			message: "Invitation rejected",
			data: result,
		});
	} catch (error: any) {
		console.error("Reject invitation error:", error);
		const message =
			error?.body?.message || error?.message || "Failed to reject invitation";
		return c.json({ success: false, message }, 400);
	}
});

export default app;
