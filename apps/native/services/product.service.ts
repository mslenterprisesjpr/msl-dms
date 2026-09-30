import { apiClient } from "@/lib/api-client";

export interface Product {
	_id: string;
	orgId: string;
	name: string;
	brandName: string;
	category: string;
	unitsPerCase: number;
	pricePerCase: number;
	pricePerUnit: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface ProductQuery {
	page?: number;
	limit?: number;
	isActive?: boolean;
	category?: string;
	search?: string;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export const getProducts = async (
	params?: ProductQuery,
): Promise<PaginatedResponse<Product>> => {
	const { data } = await apiClient.get<PaginatedResponse<Product>>(
		"/products",
		{
			params,
		},
	);
	return data;
};

export const getProductById = async (
	id: string,
): Promise<{ data: Product }> => {
	const { data } = await apiClient.get<{ data: Product }>(`/products/${id}`);
	return data;
};

export const createProduct = async (
	productData: Partial<Product>,
): Promise<{ data: Product }> => {
	const { data } = await apiClient.post<{ data: Product }>(
		"/products",
		productData,
	);
	return data;
};

export const updateProduct = async (
	id: string,
	productData: Partial<Product>,
): Promise<{ data: Product }> => {
	const { data } = await apiClient.patch<{ data: Product }>(
		`/products/${id}`,
		productData,
	);
	return data;
};

export const deleteProduct = async (id: string): Promise<void> => {
	await apiClient.delete(`/products/${id}`);
};
