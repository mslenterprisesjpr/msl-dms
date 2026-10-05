import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

// Types
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

// Get all workers' stock (admin only)
export function useAllWorkersStock() {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: ["worker-stock", "all", currentOrgId],
		queryFn: async () => {
			const { data } = await apiClient.get<{ data: WorkerStock[] }>(
				"/worker-stock/all",
			);
			return data;
		},
		enabled: !!currentOrgId,
	});
}

// Issue stock to worker (admin only)
export function useIssueStock() {
	const queryClient = useQueryClient();
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useMutation({
		mutationFn: async (data: IssueStockDto) => {
			const response = await apiClient.post("/stock/issue", data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["worker-stock", currentOrgId],
			});
			queryClient.invalidateQueries({
				queryKey: ["stock-transactions", currentOrgId],
			});
			queryClient.invalidateQueries({ queryKey: ["products", currentOrgId] });
		},
	});
}

// Return stock from worker
export function useReturnStock() {
	const queryClient = useQueryClient();
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useMutation({
		mutationFn: async (data: ReturnStockDto) => {
			const response = await apiClient.post("/stock/return", data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["worker-stock", currentOrgId],
			});
			queryClient.invalidateQueries({
				queryKey: ["stock-transactions", currentOrgId],
			});
			queryClient.invalidateQueries({ queryKey: ["products", currentOrgId] });
		},
	});
}
