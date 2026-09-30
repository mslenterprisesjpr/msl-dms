import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "./product.service";

export interface Sale {
	_id: string;
	orgId: string;
	invoiceNo: string;
	orderId?: string;
	customerId: string;
	workerId: string;
	saleDate: string;
	subtotal: number;
	discount: number;
	total: number;
	paidAmount: number;
	pendingAmount: number;
	paymentStatus: "PAID" | "PARTIAL" | "PENDING";
	status: "DRAFT" | "CONFIRMED" | "CANCELLED";
	note?: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface SaleQuery {
	page?: number;
	limit?: number;
	status?: Sale["status"];
	paymentStatus?: Sale["paymentStatus"];
	workerId?: string;
	customerId?: string;
	orderId?: string;
	search?: string;
	startDate?: string;
	endDate?: string;
}

export interface CreateSaleDto {
	invoiceNo: string;
	orderId?: string;
	customerId: string;
	workerId: string;
	saleDate?: string;
	subtotal: number;
	discount?: number;
	total: number;
	paidAmount?: number;
	pendingAmount?: number;
	paymentStatus?: Sale["paymentStatus"];
	status?: Sale["status"];
	note?: string;
	createdBy: string;
}

export interface UpdateSaleDto extends Partial<CreateSaleDto> {}

export const saleService = {
	getSales: async (query?: SaleQuery) => {
		const { data } = await apiClient.get<PaginatedResponse<Sale>>("/sales", {
			params: query,
		});
		return data;
	},

	getSaleById: async (id: string) => {
		const { data } = await apiClient.get<Sale>(`/sales/${id}`);
		return data;
	},

	createSale: async (dto: CreateSaleDto) => {
		const { data } = await apiClient.post<Sale>("/sales", dto);
		return data;
	},

	updateSale: async (id: string, dto: UpdateSaleDto) => {
		const { data } = await apiClient.patch<Sale>(`/sales/${id}`, dto);
		return data;
	},

	deleteSale: async (id: string) => {
		const { data } = await apiClient.delete(`/sales/${id}`);
		return data;
	},
};
