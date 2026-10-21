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

export interface SaleItem {
	_id: string;
	saleId: string;
	productId:
		| {
				_id: string;
				name: string;
				sku?: string;
				unit?: string;
				unitsPerCase?: number;
				packSize?: string;
				gstRate?: number;
				cgst?: number;
				sgst?: number;
		  }
		| string;
	quantity: number;
	cases?: number;
	units?: number;
	price: number;
	total: number;
	quantityDisplay?: string;
}

export interface SaleDetail extends Sale {
	customerId:
		| {
				_id: string;
				name: string;
				phone?: string;
				address?: string;
				gstNumber?: string;
		  }
		| any;
	items: SaleItem[];
	payments: any[];
}

export interface CreateSaleDto {
	customerId: string;
	items: Array<{
		productId: string;
		cases: number;
		units: number;
		price: number;
	}>;
	subtotal?: number;
	discount?: number;
	total?: number;
	paidAmount?: number;
	pendingAmount?: number;
	paymentMethod?: "CASH" | "UPI" | "CARD" | "CREDIT";
	payments?: Array<{
		amount: number;
		paymentMethod: "CASH" | "UPI" | "CARD" | "CREDIT";
		note?: string;
	}>;
	paymentStatus?: Sale["paymentStatus"];
	status?: Sale["status"];
	note?: string;
	createdBy?: string;
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
		const { data } = await apiClient.get<any>(`/sales/${id}`);
		return (data?.data || data) as SaleDetail;
	},

	createSale: async (dto: CreateSaleDto) => {
		const { data } = await apiClient.post<any>("/sales", dto);
		return (data?.sale || data?.data || data) as Sale;
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
