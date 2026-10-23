import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/hooks/use-session";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export interface OrgUserRoleResult {
	/** Organization-level member role ("admin" | "owner" | "member") */
	orgRole: string;
	/** True if user is Organization Admin or Owner */
	isOrgAdmin: boolean;
	/** True if user is Organization Worker / Salesman */
	isOrgWorker: boolean;
	/** True if user is Platform / System Super Admin */
	isSystemAdmin: boolean;
	/** Backwards-compatible aliases */
	isAdmin: boolean;
	isWorker: boolean;
	role: string;
	isLoading: boolean;
}

/**
 * useOrgUserRole
 * Specifically resolves the user's role within the active Organization (MSL Agency),
 * clearly separating Organization Roles (Agency Owner/Admin vs Delivery Worker)
 * from System Super Admin roles.
 */
export function useOrgUserRole(): OrgUserRoleResult {
	const { user, isLoading: isSessionLoading } = useSession();
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const organizations = useOrganizationStore((state) => state.organizations);
	const currentOrg = organizations.find((o) => o?.id === currentOrgId) as any;

	// Check if user is Platform/System Super Admin (God mode)
	const isSystemAdmin = user?.role === "admin";

	// Fetch Organization Member Role from server endpoint
	const { data: roleData, isLoading: isRoleLoading } = useQuery({
		queryKey: ["my-org-role", currentOrgId, user?.id],
		queryFn: async () => {
			if (!currentOrgId) return null;
			try {
				const res = await apiClient.get<{
					role: string;
					isAdmin: boolean;
					isOwner: boolean;
				}>("/organizations/my-role");
				return res.data;
			} catch {
				return null;
			}
		},
		enabled: !!currentOrgId && !!user?.id,
		staleTime: 30000,
	});

	// Check stored role in currentOrg from Better Auth organization.list()
	const storedOrgRole = currentOrg?.role;

	// User is Organization Admin if:
	// 1. System admin (always has access)
	// 2. Server says isAdmin === true in this org
	// 3. Stored member role is "admin" or "owner"
	// 4. Fallback for org creator before async check settles
	const isOrgAdmin =
		isSystemAdmin ||
		roleData?.isAdmin === true ||
		storedOrgRole === "admin" ||
		storedOrgRole === "owner" ||
		(!roleData && storedOrgRole !== "member");

	const orgRole =
		roleData?.role || storedOrgRole || (isOrgAdmin ? "admin" : "member");

	const isOrgWorker = !isOrgAdmin;

	return {
		orgRole,
		isOrgAdmin,
		isOrgWorker,
		isSystemAdmin,
		// Aliases for convenience
		isAdmin: isOrgAdmin,
		isWorker: isOrgWorker,
		role: orgRole,
		isLoading: isSessionLoading || isRoleLoading,
	};
}

// Convenient alias
export const useOrgRole = useOrgUserRole;
export const useUserRole = useOrgUserRole;
