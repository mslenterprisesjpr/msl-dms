import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export interface OrganizationMember {
	id: string;
	userId: string;
	organizationId: string;
	role: string;
	createdAt: string;
	user: {
		id: string;
		name: string;
		email: string;
		image?: string;
	};
}

export function useOrganizationMembers() {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: ["organization-members", currentOrgId],
		queryFn: async () => {
			if (!currentOrgId) {
				return [];
			}

			// Get members using Better Auth organization plugin
			const { data, error } = await authClient.organization.listMembers({
				query: {
					organizationId: currentOrgId,
				},
			});

			if (error) {
				throw new Error(error.message || "Failed to fetch members");
			}

			const members = (data?.members || []) as OrganizationMember[];
			return members;
		},
		enabled: !!currentOrgId,
	});
}
