import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "./product.service";

export interface StockTransaction {
	_id: string;
	orgId: string;
	productId:
		| string
		| {
				_id: string;
				id: string;
				name: string;
				sku: string;
				unit: string;
				unitsPerCase: number;
				stockInCases?: number;
				remainingUnits?: number;
				stockDisplay?: string;
		  };
	workerId?: string;
	type: "PURCHASE" | "ISSUE" | "SALE" | "RETURN" | "ADJUSTMENT";
	quantity: number;
	cases: number;
	units: number;
	referenceId?: string;
	note?: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	quantityDisplay?: string;
}

export interface StockQuery {
	page?: number;
	limit?: number;
	type?: StockTransaction["type"];
	productId?: string;
	workerId?: string;
	startDate?: string;
	endDate?: string;
}

export interface CreateStockTransactionDto {
	productId: string;
	workerId?: string;
	type: StockTransaction["type"];
	quantity: number;
	cases?: number;
	units?: number;
	referenceId?: string;
	note?: string;
	createdBy: string;
}

export interface UpdateStockTransactionDto
	extends Partial<CreateStockTransactionDto> {}

export const stockService = {
	getStockTransactions: async (query?: StockQuery) => {
		const { data } = await apiClient.get<PaginatedResponse<StockTransaction>>(
			"/stock/transactions",
			{ params: query },
		);
		return data;
	},

	getStockTransactionById: async (id: string) => {
		const { data } = await apiClient.get<StockTransaction>(
			`/stock/transactions/${id}`,
		);
		return data;
	},

	createStockTransaction: async (dto: CreateStockTransactionDto) => {
		const { data } = await apiClient.post<StockTransaction>("/stock", dto);
		return data;
	},

	updateStockTransaction: async (
		id: string,
		dto: UpdateStockTransactionDto,
	) => {
		const { data } = await apiClient.patch<StockTransaction>(
			`/stock/${id}`,
			dto,
		);
		return data;
	},

	deleteStockTransaction: async (id: string) => {
		const { data } = await apiClient.delete(`/stock/${id}`);
		return data;
	},
};
