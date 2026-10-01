import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customer.service";
import type {
	CreateCustomerDto,
	CustomersQuery,
	UpdateCustomerDto,
} from "@/types/customer";

export function useCustomers(query: CustomersQuery = {}) {
	return useQuery({
		queryKey: ["customers", query],
		queryFn: () => customerService.getAll(query),
	});
}

export function useCustomer(id: string) {
	return useQuery({
		queryKey: ["customers", id],
		queryFn: () => customerService.getById(id),
		enabled: !!id,
	});
}

export function useSearchCustomers(q: string) {
	return useQuery({
		queryKey: ["customers", "search", q],
		queryFn: () => customerService.search(q),
		enabled: q.length > 0,
	});
}

export function useCreateCustomer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateCustomerDto) => customerService.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["customers"] });
		},
	});
}

export function useUpdateCustomer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateCustomerDto }) =>
			customerService.update(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["customers"] });
		},
	});
}

export function useDeleteCustomer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => customerService.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["customers"] });
		},
	});
}
