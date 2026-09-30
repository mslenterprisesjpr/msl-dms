import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@/services/product.service";
import * as productService from "@/services/product.service";

export const productKeys = {
	all: ["products"] as const,
	lists: () => [...productKeys.all, "list"] as const,
	list: (filters?: productService.ProductQuery) =>
		[...productKeys.lists(), filters] as const,
	details: () => [...productKeys.all, "detail"] as const,
	detail: (id: string) => [...productKeys.details(), id] as const,
};

export const useProducts = (params?: productService.ProductQuery) => {
	return useQuery({
		queryKey: productKeys.list(params),
		queryFn: () => productService.getProducts(params),
	});
};

export const useProduct = (id: string) => {
	return useQuery({
		queryKey: productKeys.detail(id),
		queryFn: () => productService.getProductById(id),
		enabled: !!id,
	});
};

export const useCreateProduct = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: productService.createProduct,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
		},
	});
};

export const useUpdateProduct = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
			productService.updateProduct(id, data),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: productKeys.detail(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
		},
	});
};

export const useDeleteProduct = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: productService.deleteProduct,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
		},
	});
};
