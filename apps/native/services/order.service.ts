import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "./product.service";

export interface Order {
	_id: string;
	orgId: string;
	orderNo: string;
	customerId: string;
	workerId: string;
	orderDate: string;
	expectedDeliveryDate?: string;
	status: "PENDING" | "PARTIAL" | "DELIVERED" | "CANCELLED";
	deliveryType: "IMMEDIATE" | "LATER";
	subtotal: number;
	discount: number;
	total: number;
	saleId?: string;
	note?: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface OrderQuery {
	page?: number;
	limit?: number;
	status?: Order["status"];
	deliveryType?: Order["deliveryType"];
	workerId?: string;
	customerId?: string;
	search?: string;
	startDate?: string;
	endDate?: string;
}

export interface CreateOrderDto {
	orderNo: string;
	customerId: string;
	workerId: string;
	orderDate?: string;
	expectedDeliveryDate?: string;
	deliveryType?: "IMMEDIATE" | "LATER";
	subtotal: number;
	discount?: number;
	total: number;
	note?: string;
	createdBy: string;
}

export interface UpdateOrderDto extends Partial<CreateOrderDto> {
	status?: Order["status"];
	saleId?: string;
}

export const orderService = {
	getOrders: async (query?: OrderQuery) => {
		const { data } = await apiClient.get<PaginatedResponse<Order>>("/orders", {
			params: query,
		});
		return data;
	},

	getOrderById: async (id: string) => {
		const { data } = await apiClient.get<Order>(`/orders/${id}`);
		return data;
	},

	createOrder: async (dto: CreateOrderDto) => {
		const { data } = await apiClient.post<Order>("/orders", dto);
		return data;
	},

	updateOrder: async (id: string, dto: UpdateOrderDto) => {
		const { data } = await apiClient.patch<Order>(`/orders/${id}`, dto);
		return data;
	},

	deleteOrder: async (id: string) => {
		const { data } = await apiClient.delete(`/orders/${id}`);
		return data;
	},
};
