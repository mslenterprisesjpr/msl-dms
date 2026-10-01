import { apiClient } from "@/lib/api-client";
import type {
	CreateCustomerDto,
	Customer,
	CustomersQuery,
	CustomersResponse,
	UpdateCustomerDto,
} from "@/types/customer";

export const customerService = {
	getAll: async (query: CustomersQuery = {}) => {
		const params = new URLSearchParams();
		if (query.search) params.append("search", query.search);
		if (query.page) params.append("page", query.page.toString());
		if (query.limit) params.append("limit", query.limit.toString());
		if (query.isActive !== undefined)
			params.append("isActive", query.isActive.toString());

		const response = await apiClient.get<CustomersResponse>(
			`/customers?${params.toString()}`,
		);
		return response.data;
	},

	search: async (q: string) => {
		const response = await apiClient.get<{ data: Customer[] }>(
			`/customers/search?q=${encodeURIComponent(q)}`,
		);
		return response.data.data;
	},

	getById: async (id: string) => {
		const response = await apiClient.get<{ data: Customer }>(
			`/customers/${id}`,
		);
		return response.data.data;
	},

	create: async (data: CreateCustomerDto) => {
		const response = await apiClient.post<{ data: Customer }>(
			"/customers",
			data,
		);
		return response.data.data;
	},

	update: async (id: string, data: UpdateCustomerDto) => {
		const response = await apiClient.put<{ data: Customer }>(
			`/customers/${id}`,
			data,
		);
		return response.data.data;
	},

	delete: async (id: string) => {
		const response = await apiClient.delete(`/customers/${id}`);
		return response.data;
	},
};
