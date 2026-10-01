import {
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type CreatePaymentDto,
	type Payment,
	type PaymentQuery,
	paymentService,
	type UpdatePaymentDto,
} from "@/services/payment.service";

// Query Keys
export const paymentKeys = {
	all: ["payments"] as const,
	lists: () => [...paymentKeys.all, "list"] as const,
	list: (filters?: PaymentQuery) => [...paymentKeys.lists(), filters] as const,
	details: () => [...paymentKeys.all, "detail"] as const,
	detail: (id: string) => [...paymentKeys.details(), id] as const,
};

// Queries
export const usePayments = (
	query?: PaymentQuery,
	options?: Omit<
		UseQueryOptions<
			Awaited<ReturnType<typeof paymentService.getPayments>>,
			Error
		>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: paymentKeys.list(query),
		queryFn: () => paymentService.getPayments(query),
		...options,
	});
};

export const usePayment = (
	id: string,
	options?: Omit<
		UseQueryOptions<Payment, Error>,
		"queryKey" | "queryFn" | "enabled"
	>,
) => {
	return useQuery({
		queryKey: paymentKeys.detail(id),
		queryFn: () => paymentService.getPaymentById(id),
		enabled: !!id,
		...options,
	});
};

// Mutations
export const useCreatePayment = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreatePaymentDto) => paymentService.createPayment(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
		},
	});
};

export const useUpdatePayment = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, dto }: { id: string; dto: UpdatePaymentDto }) =>
			paymentService.updatePayment(id, dto),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: paymentKeys.detail(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
		},
	});
};

export const useDeletePayment = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => paymentService.deletePayment(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: paymentKeys.all });
		},
	});
};
