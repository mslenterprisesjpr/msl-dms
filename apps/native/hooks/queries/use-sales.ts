import {
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type CreateSaleDto,
	type Sale,
	type SaleQuery,
	saleService,
	type UpdateSaleDto,
} from "@/services/sale.service";

// Query Keys
export const saleKeys = {
	all: ["sales"] as const,
	lists: () => [...saleKeys.all, "list"] as const,
	list: (filters?: SaleQuery) => [...saleKeys.lists(), filters] as const,
	details: () => [...saleKeys.all, "detail"] as const,
	detail: (id: string) => [...saleKeys.details(), id] as const,
};

// Queries
export const useSales = (
	query?: SaleQuery,
	options?: Omit<
		UseQueryOptions<Awaited<ReturnType<typeof saleService.getSales>>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: saleKeys.list(query),
		queryFn: () => saleService.getSales(query),
		...options,
	});
};

export const useSale = (
	id: string,
	options?: Omit<
		UseQueryOptions<Sale, Error>,
		"queryKey" | "queryFn" | "enabled"
	>,
) => {
	return useQuery({
		queryKey: saleKeys.detail(id),
		queryFn: () => saleService.getSaleById(id),
		enabled: !!id,
		...options,
	});
};

// Mutations
export const useCreateSale = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreateSaleDto) => saleService.createSale(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: saleKeys.lists() });
		},
	});
};

export const useUpdateSale = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, dto }: { id: string; dto: UpdateSaleDto }) =>
			saleService.updateSale(id, dto),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: saleKeys.detail(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: saleKeys.lists() });
		},
	});
};

export const useDeleteSale = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => saleService.deleteSale(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: saleKeys.all });
		},
	});
};
