import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "./product.service";

export interface Payment {
	_id: string;
	orgId: string;
	saleId: string;
	amount: number;
	paymentMethod: "CASH" | "UPI" | "CARD" | "CREDIT";
	paymentDate: string;
	note?: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface PaymentQuery {
	page?: number;
	limit?: number;
	saleId?: string;
	paymentMethod?: Payment["paymentMethod"];
	startDate?: string;
	endDate?: string;
}

export interface CreatePaymentDto {
	saleId: string;
	amount: number;
	paymentMethod: Payment["paymentMethod"];
	paymentDate?: string;
	note?: string;
	createdBy: string;
}

export interface UpdatePaymentDto extends Partial<CreatePaymentDto> {}

export const paymentService = {
	getPayments: async (query?: PaymentQuery) => {
		const { data } = await apiClient.get<PaginatedResponse<Payment>>(
			"/payments",
			{ params: query },
		);
		return data;
	},

	getPaymentById: async (id: string) => {
		const { data } = await apiClient.get<Payment>(`/payments/${id}`);
		return data;
	},

	createPayment: async (dto: CreatePaymentDto) => {
		const { data } = await apiClient.post<Payment>("/payments", dto);
		return data;
	},

	updatePayment: async (id: string, dto: UpdatePaymentDto) => {
		const { data } = await apiClient.patch<Payment>(`/payments/${id}`, dto);
		return data;
	},

	deletePayment: async (id: string) => {
		const { data } = await apiClient.delete(`/payments/${id}`);
		return data;
	},
};
