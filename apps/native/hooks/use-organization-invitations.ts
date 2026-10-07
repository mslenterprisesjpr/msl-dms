import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export interface OrganizationInvitation {
	id: string;
	email: string;
	role: string;
	organizationId: string;
	status: "pending" | "accepted" | "rejected";
	expiresAt: Date | string;
	inviterId: string;
	createdAt: Date | string;
}

export function useOrganizationInvitations() {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: ["organization-invitations", currentOrgId],
		queryFn: async () => {
			if (!currentOrgId) {
				return [];
			}

			try {
				// Get invitations using Better Auth organization plugin
				const { data, error } = await authClient.organization.listInvitations({
					query: {
						organizationId: currentOrgId,
					},
				});

				if (error) {
					throw new Error(error.message || "Failed to fetch invitations");
				}

				// NOTE: Better Auth returns invitations directly as an array, not nested in data.invitations
				// Response format: { data: [invitation1, invitation2, ...], error: null }
				const invitations = (
					Array.isArray(data) ? data : []
				) as OrganizationInvitation[];
				return invitations;
			} catch (err) {
				console.error("[useOrganizationInvitations] Error:", err);
				throw err;
			}
		},
		enabled: !!currentOrgId,
	});
}
