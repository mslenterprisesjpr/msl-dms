import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "./product.service";

export interface WorkerStock {
	_id: string;
	orgId: string;
	workerId: string;
	productId: string;
	quantity: number;
	createdAt: string;
	updatedAt: string;
	stockInCases?: number;
	remainingUnits?: number;
}

export interface WorkerStockQuery {
	page?: number;
	limit?: number;
	workerId?: string;
	productId?: string;
}

export interface CreateWorkerStockDto {
	workerId: string;
	productId: string;
	quantity: number;
}

export interface UpdateWorkerStockDto extends Partial<CreateWorkerStockDto> {}

export const workerStockService = {
	getWorkerStocks: async (query?: WorkerStockQuery) => {
		const { data } = await apiClient.get<PaginatedResponse<WorkerStock>>(
			"/worker-stock",
			{ params: query },
		);
		return data;
	},

	getWorkerStockById: async (id: string) => {
		const { data } = await apiClient.get<WorkerStock>(`/worker-stock/${id}`);
		return data;
	},

	createWorkerStock: async (dto: CreateWorkerStockDto) => {
		const { data } = await apiClient.post<WorkerStock>("/worker-stock", dto);
		return data;
	},

	updateWorkerStock: async (id: string, dto: UpdateWorkerStockDto) => {
		const { data } = await apiClient.patch<WorkerStock>(
			`/worker-stock/${id}`,
			dto,
		);
		return data;
	},

	deleteWorkerStock: async (id: string) => {
		const { data } = await apiClient.delete(`/worker-stock/${id}`);
		return data;
	},
};
