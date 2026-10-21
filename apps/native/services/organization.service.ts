import { apiClient } from "@/lib/api-client";

export type OrganizationRole = "admin" | "member" | "owner";

export interface UserInvitation {
	id: string;
	organizationId: string;
	organizationName: string;
	organizationSlug: string;
	organizationLogo?: string | null;
	email: string;
	role: string;
	status: string;
	createdAt: string;
	expiresAt: string;
}

export const organizationService = {
	addMember: async (data: {
		organizationId: string;
		userId?: string;
		email?: string;
		role: OrganizationRole | string;
	}) => {
		const res = await apiClient.post<{
			success: boolean;
			message: string;
			memberAdded?: boolean;
			invited?: boolean;
			data?: any;
		}>("/organizations/add-member", data);
		return res.data;
	},

	getUserInvitations: async () => {
		const res = await apiClient.get<{
			success: boolean;
			invitations: UserInvitation[];
		}>("/organizations/user-invitations");
		return res.data.invitations || [];
	},

	acceptInvitation: async (invitationId: string) => {
		const res = await apiClient.post<{
			success: boolean;
			message: string;
		}>("/organizations/accept-invitation", { invitationId });
		return res.data;
	},

	rejectInvitation: async (invitationId: string) => {
		const res = await apiClient.post<{
			success: boolean;
			message: string;
		}>("/organizations/reject-invitation", { invitationId });
		return res.data;
	},

	updateMetadata: async (
		organizationId: string,
		metadata: {
			gstin?: string;
			phone?: string;
			address?: string;
			[key: string]: any;
		},
	) => {
		const res = await apiClient.patch<{
			success: boolean;
			message: string;
			data?: any;
		}>("/organizations/update-metadata", metadata, {
			headers: {
				"x-organization-id": organizationId,
			},
		});
		return res.data;
	},
};
