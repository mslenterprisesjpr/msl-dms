import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "./product.service";

export interface Customer {
	_id: string;
	orgId: string;
	name: string;
	phone?: string;
	address?: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CustomerQuery {
	page?: number;
	limit?: number;
	isActive?: boolean;
	search?: string;
}

export interface CreateCustomerDto {
	name: string;
	phone?: string;
	address?: string;
	isActive?: boolean;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export const customerService = {
	getCustomers: async (query?: CustomerQuery) => {
		const { data } = await apiClient.get<PaginatedResponse<Customer>>(
			"/customers",
			{ params: query },
		);
		return data;
	},

	getCustomerById: async (id: string) => {
		const { data } = await apiClient.get<Customer>(`/customers/${id}`);
		return data;
	},

	createCustomer: async (dto: CreateCustomerDto) => {
		const { data } = await apiClient.post<Customer>("/customers", dto);
		return data;
	},

	updateCustomer: async (id: string, dto: UpdateCustomerDto) => {
		const { data } = await apiClient.patch<Customer>(`/customers/${id}`, dto);
		return data;
	},

	deleteCustomer: async (id: string) => {
		const { data } = await apiClient.delete(`/customers/${id}`);
		return data;
	},
};
