import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

// Types
export interface WorkerStockProduct {
	productId: string;
	productName: string;
	sku?: string;
	packSize?: string;
	quantity: number;
	stockInCases: number;
	remainingUnits: number;
	unit: string;
	unitsPerCase: number;
	sellingRate: number;
	itemValue: number;
}

export interface WorkerVanSummary {
	workerId: string;
	workerName: string;
	workerEmail?: string;
	workerImage?: string | null;
	products: WorkerStockProduct[];
	totalItems: number;
	totalUnits: number;
	totalCases: number;
	stockValue: number;
	todayStats: {
		billsCount: number;
		totalSales: number;
		cashCollected: number;
		upiCollected: number;
		totalCollected: number;
		pendingCredit: number;
	};
}

export interface AllWorkersStockResponse {
	message: string;
	summary: {
		totalWorkers: number;
		totalUnitsInVans: number;
		totalCasesInVans: number;
		totalStockValue: number;
		totalTodaySales: number;
		totalCashToCollect: number;
		totalUpiCollected: number;
	};
	data: WorkerVanSummary[];
}

export interface WorkerStock {
	_id: string;
	orgId: string;
	workerId: string;
	productId: {
		_id: string;
		name: string;
		sku: string;
		packSize: string;
		unit: string;
		unitsPerCase: number;
	};
	stock: number; // Total units
	stockInCases?: number;
	remainingUnits?: number;
	stockDisplay?: string;
	createdAt: string;
	updatedAt: string;
}

export interface IssueStockDto {
	workerId: string;
	productId: string;
	quantity: number; // Total units
	cases?: number;
	units?: number;
	note?: string;
}

export interface ReturnStockDto {
	productId: string;
	quantity: number; // Total units
	cases?: number;
	units?: number;
	note?: string;
}

export interface CloseDayDto {
	workerId: string;
	cashReceived: number;
	returnAllStockToWarehouse: boolean;
	note?: string;
}

// Get current worker's stock (for worker role)
export function useWorkerStock() {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: ["worker-stock", currentOrgId],
		queryFn: async () => {
			const { data } = await apiClient.get<{ data: WorkerStock[] }>(
				"/worker-stock/my-stock",
			);
			return data;
		},
		enabled: !!currentOrgId,
	});
}

// Get specific worker's stock (for admin)
export function useWorkerStockByWorker(workerId: string) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: ["worker-stock", currentOrgId, workerId],
		queryFn: async () => {
			const { data } = await apiClient.get<{ data: WorkerStock[] }>(
				`/worker-stock/${workerId}`,
			);
			return data;
		},
		enabled: !!currentOrgId && !!workerId,
	});
}

// Get all workers' stock & day-end summary (admin only)
export function useAllWorkersStock() {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: ["worker-stock", "all", currentOrgId],
		queryFn: async () => {
			const { data } =
				await apiClient.get<AllWorkersStockResponse>("/worker-stock/all");
			return data;
		},
		enabled: !!currentOrgId,
		refetchOnWindowFocus: true,
		refetchOnMount: "always",
	});
}

// Issue stock to worker (admin only)
export function useIssueStock() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: IssueStockDto) => {
			const response = await apiClient.post("/stock/issue", data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["worker-stock"] });
			queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.invalidateQueries({ queryKey: ["stock"] });
		},
	});
}

// Return stock from worker
export function useReturnStock() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: ReturnStockDto) => {
			const response = await apiClient.post("/stock/return", data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["worker-stock"] });
			queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.invalidateQueries({ queryKey: ["stock"] });
		},
	});
}

// Day-End Settlement - Close Day for worker
export function useCloseDay() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: CloseDayDto) => {
			const response = await apiClient.post("/worker-stock/close-day", data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["worker-stock"] });
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
			queryClient.invalidateQueries({ queryKey: ["stock"] });
		},
	});
}
