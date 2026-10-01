import {
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type CreateStockTransactionDto,
	type StockQuery,
	type StockTransaction,
	stockService,
	type UpdateStockTransactionDto,
} from "@/services/stock.service";

// Query Keys
export const stockKeys = {
	all: ["stock"] as const,
	lists: () => [...stockKeys.all, "list"] as const,
	list: (filters?: StockQuery) => [...stockKeys.lists(), filters] as const,
	details: () => [...stockKeys.all, "detail"] as const,
	detail: (id: string) => [...stockKeys.details(), id] as const,
};

// Queries
export const useStockTransactions = (
	query?: StockQuery,
	options?: Omit<
		UseQueryOptions<
			Awaited<ReturnType<typeof stockService.getStockTransactions>>,
			Error
		>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: stockKeys.list(query),
		queryFn: () => stockService.getStockTransactions(query),
		...options,
	});
};

export const useStockTransaction = (
	id: string,
	options?: Omit<
		UseQueryOptions<StockTransaction, Error>,
		"queryKey" | "queryFn" | "enabled"
	>,
) => {
	return useQuery({
		queryKey: stockKeys.detail(id),
		queryFn: () => stockService.getStockTransactionById(id),
		enabled: !!id,
		...options,
	});
};

// Mutations
export const useCreateStockTransaction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreateStockTransactionDto) =>
			stockService.createStockTransaction(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: stockKeys.lists() });
		},
	});
};

export const useUpdateStockTransaction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, dto }: { id: string; dto: UpdateStockTransactionDto }) =>
			stockService.updateStockTransaction(id, dto),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: stockKeys.detail(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: stockKeys.lists() });
		},
	});
};

export const useDeleteStockTransaction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => stockService.deleteStockTransaction(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: stockKeys.all });
		},
	});
};
