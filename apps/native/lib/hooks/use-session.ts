import { authClient } from "@/lib/auth-client";

/**
 * Hook to get the current user session.
 * Wraps Better Auth's useSession for convenient access across the app.
 */
export function useSession() {
	const { data: session, isPending, error, refetch } = authClient.useSession();

	return {
		session,
		isLoading: isPending,
		error,
		refetch,
		user: session?.user ?? null,
		isLoggedIn: !!session,
	};
}
