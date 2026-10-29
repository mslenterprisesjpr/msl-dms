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

	// Update organization metadata (Store GSTIN, phone, address)
	updateMetadata: async (metadata: {
		organizationId: string;
		gstin?: string;
		phone?: string;
		address?: string;
	}) => {
		const res = await apiClient.patch<{
			success: boolean;
			message: string;
			data?: any;
		}>("/organizations/metadata", metadata);
		return res.data;
	},

	createWorker: async (data: {
		organizationId?: string;
		name: string;
		phone?: string;
		email?: string;
		password: string;
		vanName?: string;
		role?: OrganizationRole | string;
	}) => {
		const res = await apiClient.post<{
			success: boolean;
			message: string;
			worker: {
				id: string;
				name: string;
				email: string;
				phone?: string;
				vanName?: string;
				role: string;
			};
		}>("/organizations/create-worker", data);
		return res.data;
	},
};
