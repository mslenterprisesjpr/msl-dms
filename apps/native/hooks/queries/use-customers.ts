import {
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type CreateCustomerDto,
	type Customer,
	type CustomersQuery,
	type CustomersResponse,
	customerService,
	type UpdateCustomerDto,
} from "@/services/customer.service";

// Query Keys
export const customerKeys = {
	all: ["customers"] as const,
	lists: () => [...customerKeys.all, "list"] as const,
	list: (filters?: CustomersQuery) =>
		[...customerKeys.lists(), filters] as const,
	details: () => [...customerKeys.all, "detail"] as const,
	detail: (id: string) => [...customerKeys.details(), id] as const,
};

// Queries
export const useCustomers = (
	query?: CustomersQuery,
	options?: Omit<
		UseQueryOptions<CustomersResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: customerKeys.list(query),
		queryFn: () => customerService.getAll(query),
		...options,
	});
};

export const useCustomer = (
	id: string,
	options?: Omit<
		UseQueryOptions<Customer, Error>,
		"queryKey" | "queryFn" | "enabled"
	>,
) => {
	return useQuery({
		queryKey: customerKeys.detail(id),
		queryFn: () => customerService.getById(id),
		enabled: !!id,
		...options,
	});
};

// Mutations
export const useCreateCustomer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreateCustomerDto) => customerService.create(dto),
		onSuccess: () => {
			// Invalidate all customer lists
			queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
		},
	});
};

export const useUpdateCustomer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, dto }: { id: string; dto: UpdateCustomerDto }) =>
			customerService.update(id, dto),
		onSuccess: (_data, variables) => {
			// Invalidate specific customer detail
			queryClient.invalidateQueries({
				queryKey: customerKeys.detail(variables.id),
			});
			// Invalidate all customer lists
			queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
		},
	});
};

export const useDeleteCustomer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => customerService.delete(id),
		onSuccess: () => {
			// Invalidate all customers (lists and details)
			queryClient.invalidateQueries({ queryKey: customerKeys.all });
		},
	});
};
