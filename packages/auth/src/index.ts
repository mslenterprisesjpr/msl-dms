// @ts-nocheck
import { expo } from "@better-auth/expo";
import type { Database } from "@msl/db";
import { mongoClient } from "@msl/db";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin, organization } from "better-auth/plugins";

export type AuthConfig = {
	BETTER_AUTH_URL: string;
	BETTER_AUTH_SECRET: string;
	CORS_ORIGIN: string;
};

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = [],
) {
	return betterAuth({
		database: mongodbAdapter(database, {
			// Pass the client for transaction support
			client: mongoClient || undefined,
		}),
		trustedOrigins: [
			env.CORS_ORIGIN,
			...desktopOrigins,
			"msl://",
			"msl://*",
			"exp://", // Trust any host of the exp:// scheme
			"exp://**",
			"http://localhost:8081",
		],
		emailAndPassword: { enabled: true },
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
			// Enable database joins for better performance (2-3x faster)
			database: {
				joins: true,
			},
			// Enable debug mode to see what's happening
			hooks: {
				after: [
					{
						matcher(context) {
							return context.path?.includes("organization");
						},
						handler: async (ctx) => {
							console.log("=== BETTER AUTH HOOK: AFTER ===");
							console.log("Path:", ctx.path);
							console.log("Method:", ctx.method);
							console.log(
								"Returned data:",
								JSON.stringify(ctx.returned, null, 2),
							);
							console.log("================================");
						},
					},
				],
			},
		},
		plugins: [
			expo(),
			admin(),
			organization({
				// Allow all users to create organizations (change to false for admin-only)
				allowUserToCreateOrganization: true,
				creatorRole: "admin",
				requireEmailVerificationOnInvitation: false,
				async sendInvitationEmail(data) {
					console.log(
						`[INVITATION] Organization invitation created for ${data.email} to join ${data.organization.name}`,
					);
				},
			}),
		],
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
export type AppUser = Session["user"];
export type AppSession = Session["session"];
export type Organization = ReturnType<
	typeof createAuth
>["$Infer"]["Organization"];
