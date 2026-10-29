import type { AppSession as Session, AppUser as User } from "@msl/auth";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ObjectId } from "mongodb";

import { resolveOrganizationId } from "@/lib/org-context";
import { requireAuth } from "@/middleware/authentication.middleware";
import {
	isValidOrganizationRole,
	OrganizationRole,
	requireAdmin,
} from "@/middleware/authorization.middleware";
import { auth, db } from "@/services";

type Variables = {
	user: User | null;
	session: Session | null;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * GET /my-role
 * Returns the current authenticated user's role in the active organization.
 */
app.get("/my-role", requireAuth, async (c) => {
	const user = c.get("user") as User;
	if (!user) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	const organizationId = await resolveOrganizationId(c);
	if (!organizationId) {
		const isSys = user.role === "admin";
		return c.json({
			role: isSys ? "admin" : "member",
			isAdmin: isSys,
			isOwner: isSys,
		});
	}

	// Query member table for org-level role
	const member = await db.collection("member").findOne({
		organizationId,
		userId: user.id,
	});

	const isSys = user.role === "admin";
	const memberRole = member?.role || "admin";
	const isAdmin = isSys || memberRole === "admin" || memberRole === "owner";

	return c.json({
		role: memberRole,
		isAdmin,
		isOwner: memberRole === "owner",
	});
});

/**
 * POST /create-worker
 * Directly creates a worker/salesman account (Name, Phone/Email, Password, Van/Route)
 * without any email verification or invite link hurdles.
 * Immediately links the worker as an active member of the active organization.
 */
app.post("/create-worker", requireAuth, requireAdmin, async (c) => {
	const organizationId = await resolveOrganizationId(c);

	if (!organizationId) {
		throw new HTTPException(400, { message: "Organization ID is required" });
	}

	const body = await c.req.json().catch(() => ({}));
	const { name, phone, email, password, vanName, role } = body as {
		name?: string;
		phone?: string;
		email?: string;
		password?: string;
		vanName?: string;
		role?: string;
	};

	if (!name || !name.trim()) {
		throw new HTTPException(400, { message: "Worker name is required" });
	}

	if (!password || password.length < 6) {
		throw new HTTPException(400, {
			message: "Password must be at least 6 characters",
		});
	}

	const cleanPhone = (phone || "").replace(/\D/g, "");
	let resolvedEmail = (email || "").trim().toLowerCase();

	if (!resolvedEmail) {
		if (cleanPhone.length >= 10) {
			resolvedEmail = `${cleanPhone.slice(-10)}@msl.local`;
		} else {
			throw new HTTPException(400, {
				message:
					"Either a valid 10-digit mobile number or an email is required",
			});
		}
	}

	const memberRole = role || "member";
	if (!isValidOrganizationRole(memberRole)) {
		throw new HTTPException(400, { message: `Invalid role: ${memberRole}` });
	}

	// Check if user already exists
	const existingUser = await db.collection("user").findOne({
		$or: [
			{ email: resolvedEmail },
			...(cleanPhone.length >= 10 ? [{ phone: cleanPhone.slice(-10) }] : []),
		],
	});

	let userId = "";

	if (existingUser) {
		userId = existingUser._id
			? existingUser._id.toString()
			: (existingUser.id as string);

		// Update phone and vanName if provided
		await db.collection("user").updateOne(
			{ _id: existingUser._id },
			{
				$set: {
					name: name.trim(),
					...(cleanPhone ? { phone: cleanPhone.slice(-10) } : {}),
					...(vanName ? { vanName: vanName.trim() } : {}),
					emailVerified: true,
					updatedAt: new Date(),
				},
			},
		);
	} else {
		// Create user via Better Auth
		let createdUserResult: any;
		try {
			createdUserResult = await auth.api.signUpEmail({
				body: {
					name: name.trim(),
					email: resolvedEmail,
					password,
				},
			});
		} catch (signupErr: any) {
			console.log(
				"signUpEmail attempt error, trying createUser:",
				signupErr?.message,
			);
			try {
				createdUserResult = await auth.api.createUser({
					body: {
						name: name.trim(),
						email: resolvedEmail,
						password,
						role: "user",
					},
				});
			} catch (createErr: any) {
				console.error("User creation failed:", createErr);
				throw new HTTPException(400, {
					message:
						createErr?.message ||
						signupErr?.message ||
						"Failed to create worker account",
				});
			}
		}

		const createdUser = createdUserResult?.user || createdUserResult;
		userId = createdUser?._id ? createdUser._id.toString() : createdUser?.id;

		if (!userId) {
			throw new HTTPException(500, {
				message: "Failed to resolve new user ID",
			});
		}

		// Update user record with phone, vanName, and emailVerified: true
		await db.collection("user").updateOne(
			{
				$or: [
					{ id: userId },
					...(ObjectId.isValid(userId) ? [{ _id: new ObjectId(userId) }] : []),
				],
			},
			{
				$set: {
					emailVerified: true,
					...(cleanPhone ? { phone: cleanPhone.slice(-10) } : {}),
					...(vanName ? { vanName: vanName.trim() } : {}),
					updatedAt: new Date(),
				},
			},
		);
	}

	// Link user to organization as member
	const existingMember = await db.collection("member").findOne({
		organizationId,
		userId,
	});

	if (!existingMember) {
		try {
			await auth.api.addMember({
				body: {
					userId,
					role: memberRole,
					organizationId,
				},
			});
		} catch (addMemberErr: any) {
			console.log(
				"auth.api.addMember fallback to direct insert:",
				addMemberErr?.message,
			);
			await db.collection("member").insertOne({
				id: new ObjectId().toString(),
				organizationId,
				userId,
				role: memberRole,
				createdAt: new Date(),
			});
		}
	}

	return c.json(
		{
			success: true,
			message: `Worker "${name.trim()}" onboarded successfully!`,
			worker: {
				id: userId,
				name: name.trim(),
				email: resolvedEmail,
				phone: cleanPhone.slice(-10) || undefined,
				vanName: vanName?.trim() || undefined,
				role: memberRole,
			},
		},
		201,
	);
});

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

	const memberRole = role || "member";

	// Validate role
	if (!isValidOrganizationRole(memberRole)) {
		throw new HTTPException(400, {
			message: `Invalid role: ${memberRole}. Valid roles are: ${Object.values(OrganizationRole).join(", ")}`,
		});
	}

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

/**
 * PATCH /metadata
 * Update organization metadata (GSTIN, phone, address, etc.)
 * Simple approach - directly update metadata field
 */
app.patch("/metadata", requireAuth, requireAdmin, async (c) => {
	try {
		const body = await c.req.json().catch(() => ({}));

		console.log("=== METADATA UPDATE REQUEST ===");
		console.log("Body received:", JSON.stringify(body, null, 2));

		const {
			organizationId: bodyOrgId,
			gstin,
			phone,
			address,
			...otherMetadata
		} = body as {
			organizationId?: string;
			gstin?: string;
			phone?: string;
			address?: string;
			[key: string]: any;
		};

		// Use explicit org ID from body, or fallback to resolved
		const organizationId = bodyOrgId || (await resolveOrganizationId(c));

		console.log("Resolved organizationId:", organizationId);

		if (!organizationId) {
			console.log("ERROR: No organization ID found");
			throw new HTTPException(400, { message: "Organization ID is required" });
		}

		// Get existing org - check both id and _id fields for compatibility
		let orgQuery: any = { id: organizationId };

		if (ObjectId.isValid(organizationId)) {
			orgQuery = {
				$or: [{ id: organizationId }, { _id: new ObjectId(organizationId) }],
			};
		}

		const existingOrg = await db.collection("organization").findOne(orgQuery);

		console.log("Found org:", existingOrg ? "YES" : "NO");

		if (!existingOrg) {
			console.log("ERROR: Organization not found in database");
			throw new HTTPException(404, { message: "Organization not found" });
		}

		// Merge metadata
		const currentMetadata = (existingOrg.metadata as Record<string, any>) || {};
		const updatedMetadata = {
			...currentMetadata,
			...otherMetadata,
		};

		// Add store details
		if (gstin !== undefined) {
			const gstValue = gstin.trim().toUpperCase();
			updatedMetadata.gstin = gstValue;
			updatedMetadata.gstNumber = gstValue;
		}
		if (phone !== undefined) {
			updatedMetadata.phone = phone.trim();
		}
		if (address !== undefined) {
			updatedMetadata.address = address.trim();
		}

		// Update in MongoDB - use $or for compatibility with different id fields
		let updateQuery: any = { id: organizationId };

		if (ObjectId.isValid(organizationId)) {
			updateQuery = {
				$or: [{ id: organizationId }, { _id: new ObjectId(organizationId) }],
			};
		}

		const updateResult = await db
			.collection("organization")
			.updateOne(updateQuery, {
				$set: {
					metadata: updatedMetadata,
					updatedAt: new Date(),
				},
			});

		console.log("MongoDB update result:", updateResult);
		console.log("Updated metadata:", updatedMetadata);
		console.log("===============================");

		return c.json({
			success: true,
			message: "Store settings updated successfully",
			data: { metadata: updatedMetadata },
		});
	} catch (error: any) {
		console.error("Update metadata error:", error);
		const message = error?.message || "Failed to update store settings";
		throw new HTTPException(error?.status || 500, { message });
	}
});

export default app;
