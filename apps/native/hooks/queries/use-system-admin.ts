import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface SystemAdminStats {
	success: boolean;
	totalOrganizations: number;
	activeOrganizations: number;
	totalUsers: number;
	totalRevenue: number;
	totalBills: number;
	systemStatus: "OPTIMAL" | "DEGRADED" | "DOWN";
	uptimeSeconds: number;
	timestamp: string;
}

export interface SystemAdminOrg {
	id: string;
	_id: string;
	name: string;
	slug?: string;
	logo?: string | null;
	metadata?: Record<string, any>;
	createdAt?: string;
	memberCount: number;
	sampleMembers?: Array<{
		userId: string;
		role: string;
	}>;
}

export interface SystemAdminUser {
	id: string;
	_id: string;
	name: string;
	email: string;
	role: "admin" | "user";
	emailVerified: boolean;
	createdAt?: string;
	organizations: Array<{
		organizationId: string;
		organizationName: string;
		role: string;
	}>;
}

export interface SystemAdminTelemetry {
	success: boolean;
	health: string;
	database: string;
	nodeVersion: string;
	uptime: string;
	uptimeSeconds: number;
	memory: {
		heapUsedMB: number;
		heapTotalMB: number;
		rssMB: number;
	};
	collectionCounts: {
		users: number;
		organizations: number;
		products: number;
		customers: number;
		sales: number;
		orders: number;
		stockTransactions: number;
	};
	timestamp: string;
}

export function useSystemAdminStats(enabled = true) {
	return useQuery({
		queryKey: ["system-admin", "stats"],
		queryFn: async () => {
			const { data } = await apiClient.get<SystemAdminStats>(
				"/system-admin/stats",
			);
			return data;
		},
		enabled,
		refetchInterval: 30000,
	});
}

export function useSystemAdminOrganizations(search?: string, enabled = true) {
	return useQuery({
		queryKey: ["system-admin", "organizations", search],
		queryFn: async () => {
			const params = search ? { search } : undefined;
			const { data } = await apiClient.get<{
				success: boolean;
				count: number;
				data: SystemAdminOrg[];
			}>("/system-admin/organizations", { params });
			return data.data;
		},
		enabled,
	});
}

export function useSystemAdminUsers(search?: string, enabled = true) {
	return useQuery({
		queryKey: ["system-admin", "users", search],
		queryFn: async () => {
			const params = search ? { search } : undefined;
			const { data } = await apiClient.get<{
				success: boolean;
				count: number;
				data: SystemAdminUser[];
			}>("/system-admin/users", { params });
			return data.data;
		},
		enabled,
	});
}

export function useUpdateUserSystemRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			userId,
			role,
		}: {
			userId: string;
			role: "admin" | "user";
		}) => {
			const { data } = await apiClient.patch(
				`/system-admin/users/${userId}/role`,
				{ role },
			);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["system-admin", "users"] });
			queryClient.invalidateQueries({ queryKey: ["system-admin", "stats"] });
		},
	});
}

export function useSystemAdminTelemetry(enabled = true) {
	return useQuery({
		queryKey: ["system-admin", "telemetry"],
		queryFn: async () => {
			const { data } = await apiClient.get<SystemAdminTelemetry>(
				"/system-admin/telemetry",
			);
			return data;
		},
		enabled,
		refetchInterval: 15000,
	});
}
