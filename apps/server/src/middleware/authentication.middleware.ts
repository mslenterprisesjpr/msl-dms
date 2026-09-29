import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "@/services";

/**
 * Authentication middleware to protect routes
 * Checks for valid session and attaches user info to context
 */
export async function requireAuth(c: Context, next: () => Promise<void>) {
	try {
		// Get session from auth handler
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});

		if (!session) {
			throw new HTTPException(401, { message: "Unauthorized" });
		}

		// Attach user info to context
		c.set("user", session.user);
		c.set("session", session.session);

		await next();
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		console.error("Auth middleware error:", error);
		throw new HTTPException(401, { message: "Unauthorized" });
	}
}
