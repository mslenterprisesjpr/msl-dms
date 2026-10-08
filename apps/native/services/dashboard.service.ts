import { apiClient } from "@/lib/api-client";

export interface AdminStats {
	totalProducts: number;
	totalCustomers: number;
	pendingOrders: number;
	lowStockCount: number;
	monthlyRevenue: number;
	todaySales: number;
	totalOutstanding: number;
	todayCollection: number;
}

export interface WorkerStats {
	totalStockItems: number;
	issuedToday: number;
	returnsToday: number;
	lowStockItems: number;
}

export const dashboardService = {
	getAdminStats: async (): Promise<AdminStats> => {
		const response = await apiClient.get<AdminStats>("/dashboard/admin-stats");
		return response.data;
	},

	getWorkerStats: async (workerId?: string): Promise<WorkerStats> => {
		const params = workerId ? `?workerId=${workerId}` : "";
		const response = await apiClient.get<WorkerStats>(
			`/dashboard/worker-stats${params}`,
		);
		return response.data;
	},
};
