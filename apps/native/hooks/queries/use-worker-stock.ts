import {
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type CreateWorkerStockDto,
	type UpdateWorkerStockDto,
	type WorkerStock,
	type WorkerStockQuery,
	workerStockService,
} from "@/services/worker-stock.service";

// Query Keys
export const workerStockKeys = {
	all: ["workerStock"] as const,
	lists: () => [...workerStockKeys.all, "list"] as const,
	list: (filters?: WorkerStockQuery) =>
		[...workerStockKeys.lists(), filters] as const,
	details: () => [...workerStockKeys.all, "detail"] as const,
	detail: (id: string) => [...workerStockKeys.details(), id] as const,
};

// Queries
export const useWorkerStocks = (
	query?: WorkerStockQuery,
	options?: Omit<
		UseQueryOptions<
			Awaited<ReturnType<typeof workerStockService.getWorkerStocks>>,
			Error
		>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: workerStockKeys.list(query),
		queryFn: () => workerStockService.getWorkerStocks(query),
		...options,
	});
};

export const useWorkerStock = (
	id: string,
	options?: Omit<
		UseQueryOptions<WorkerStock, Error>,
		"queryKey" | "queryFn" | "enabled"
	>,
) => {
	return useQuery({
		queryKey: workerStockKeys.detail(id),
		queryFn: () => workerStockService.getWorkerStockById(id),
		enabled: !!id,
		...options,
	});
};

// Mutations
export const useCreateWorkerStock = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreateWorkerStockDto) =>
			workerStockService.createWorkerStock(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: workerStockKeys.lists() });
		},
	});
};

export const useUpdateWorkerStock = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, dto }: { id: string; dto: UpdateWorkerStockDto }) =>
			workerStockService.updateWorkerStock(id, dto),
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: workerStockKeys.detail(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: workerStockKeys.lists() });
		},
	});
};

export const useDeleteWorkerStock = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => workerStockService.deleteWorkerStock(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: workerStockKeys.all });
		},
	});
};
