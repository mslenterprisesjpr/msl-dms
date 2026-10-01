import {
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type CreateOrderDto,
	type Order,
	type OrderQuery,
	orderService,
	type UpdateOrderDto,
} from "@/services/order.service";

// Query Keys
export const orderKeys = {
	all: ["orders"] as const,
	lists: () => [...orderKeys.all, "list"] as const,
	list: (filters?: OrderQuery) => [...orderKeys.lists(), filters] as const,
	details: () => [...orderKeys.all, "detail"] as const,
	detail: (id: string) => [...orderKeys.details(), id] as const,
};

// Queries
export const useOrders = (
	query?: OrderQuery,
	options?: Omit<
		UseQueryOptions<Awaited<ReturnType<typeof orderService.getOrders>>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: orderKeys.list(query),
		queryFn: () => orderService.getOrders(query),
		...options,
	});
};

export const useOrder = (
	id: string,
	options?: Omit<
		UseQueryOptions<Order, Error>,
		"queryKey" | "queryFn" | "enabled"
	>,
) => {
	return useQuery({
		queryKey: orderKeys.detail(id),
		queryFn: () => orderService.getOrderById(id),
		enabled: !!id,
		...options,
	});
};

// Mutations
export const useCreateOrder = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreateOrderDto) => orderService.createOrder(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
		},
	});
};

export const useUpdateOrder = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, dto }: { id: string; dto: UpdateOrderDto }) =>
			orderService.updateOrder(id, dto),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: orderKeys.detail(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
		},
	});
};

export const useDeleteOrder = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => orderService.deleteOrder(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orderKeys.all });
		},
	});
};
