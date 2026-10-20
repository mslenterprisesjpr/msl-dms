import { useQuery } from "@tanstack/react-query";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
	type ProductSalesReportResponse,
	type ReportPeriod,
	reportService,
	type SalesSummaryResponse,
	type StockSummaryResponse,
	type WorkerPerformanceResponse,
} from "@/services/report.service";

export const reportKeys = {
	all: ["reports"] as const,
	salesSummary: (orgId: string | null, period: ReportPeriod) =>
		[...reportKeys.all, "sales-summary", orgId, period] as const,
	workerPerformance: (orgId: string | null, period: ReportPeriod) =>
		[...reportKeys.all, "worker-performance", orgId, period] as const,
	productSales: (orgId: string | null, period: ReportPeriod) =>
		[...reportKeys.all, "product-sales", orgId, period] as const,
	stockSummary: (orgId: string | null) =>
		[...reportKeys.all, "stock-summary", orgId] as const,
	pendingPayments: (orgId: string | null) =>
		[...reportKeys.all, "pending-payments", orgId] as const,
};

export function useSalesSummary(
	period: ReportPeriod = "month",
	options?: { enabled?: boolean },
) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: reportKeys.salesSummary(currentOrgId, period),
		queryFn: () => reportService.getSalesSummary(period),
		enabled: options?.enabled !== false && !!currentOrgId,
	});
}

export function useWorkerPerformance(
	period: ReportPeriod = "month",
	options?: { enabled?: boolean },
) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: reportKeys.workerPerformance(currentOrgId, period),
		queryFn: () => reportService.getWorkerPerformance(period),
		enabled: options?.enabled !== false && !!currentOrgId,
	});
}

export function useProductSales(
	period: ReportPeriod = "month",
	options?: { enabled?: boolean },
) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: reportKeys.productSales(currentOrgId, period),
		queryFn: () => reportService.getProductSales(period),
		enabled: options?.enabled !== false && !!currentOrgId,
	});
}

export function useStockSummary(options?: { enabled?: boolean }) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: reportKeys.stockSummary(currentOrgId),
		queryFn: () => reportService.getStockSummary(),
		enabled: options?.enabled !== false && !!currentOrgId,
	});
}

export function usePendingPayments(options?: { enabled?: boolean }) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: reportKeys.pendingPayments(currentOrgId),
		queryFn: () => reportService.getPendingPayments(),
		enabled: options?.enabled !== false && !!currentOrgId,
	});
}
