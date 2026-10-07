import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export interface OrganizationInvitation {
	id: string;
	email: string;
	role: string;
	organizationId: string;
	status: string;
	inviterId: string;
	expiresAt: string;
	createdAt?: string;
}

export function useOrganizationInvitations() {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: ["organization-invitations", currentOrgId],
		queryFn: async () => {
			if (!currentOrgId) {
				return [];
			}

			const { data, error } = await authClient.organization.listInvitations({
				organizationId: currentOrgId,
			});

			if (error) {
				throw new Error(error.message || "Failed to fetch invitations");
			}

			return (data || []) as OrganizationInvitation[];
		},
		enabled: !!currentOrgId,
	});
}
