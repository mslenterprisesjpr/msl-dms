import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface SystemStats {
	success: boolean;
	totalOrganizations: number;
	activeOrganizations: number;
	totalUsers: number;
	totalRevenue: number;
	totalBills: number;
	systemStatus: "OPTIMAL" | "DEGRADED" | "DOWN";
	timestamp: string;
}

export function useSystemStats(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: ["system-stats"],
		queryFn: async () => {
			const { data } = await apiClient.get<SystemStats>(
				"/dashboard/system-stats",
			);
			return data;
		},
		enabled: options?.enabled ?? true,
		refetchInterval: 60000, // Refresh every 1 min
	});
}
