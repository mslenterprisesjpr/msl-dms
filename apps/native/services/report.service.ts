import { apiClient } from "@/lib/api-client";

export type ReportPeriod = "today" | "week" | "month" | "year" | "all";

export interface SalesSummaryData {
	totalSales: number;
	totalRevenue: number;
	totalDiscount: number;
	totalPaid: number;
	totalPending: number;
}

export interface PaymentBreakdownItem {
	_id: string; // CASH, UPI, etc.
	total: number;
	count: number;
}

export interface TopProductItem {
	productId: string;
	productName: string;
	sku?: string;
	totalQuantity: number;
	totalCases?: number;
	totalRevenue: number;
	salesCount: number;
}

export interface SalesSummaryResponse {
	period: ReportPeriod;
	startDate: string;
	endDate: string;
	summary: SalesSummaryData;
	paymentBreakdown: PaymentBreakdownItem[];
	topProducts: TopProductItem[];
}

export interface WorkerPerformanceItem {
	workerId: string;
	workerName: string;
	workerEmail?: string;
	workerImage?: string | null;
	totalSales: number;
	totalRevenue: number;
	totalPaid: number;
	totalPending: number;
	avgSaleValue: number;
	collectionRate: number;
}

export interface WorkerPerformanceResponse {
	period: ReportPeriod;
	startDate: string;
	endDate: string;
	workers: WorkerPerformanceItem[];
}

export interface ProductSaleReportItem {
	productId: string;
	productName: string;
	sku?: string;
	unit?: string;
	unitsPerCase?: number;
	totalQuantity: number;
	totalCases: number;
	totalUnits: number;
	totalRevenue: number;
	salesCount: number;
	avgPrice: number;
}

export interface ProductSalesReportResponse {
	period: ReportPeriod;
	startDate: string;
	endDate: string;
	products: ProductSaleReportItem[];
}

export interface StockSummaryProductItem {
	productId: string;
	name: string;
	sku?: string;
	unit?: string;
	warehouseStock: number;
	warehouseStockInCases: number;
	warehouseRemainingUnits: number;
	workerStock: number;
	totalStock: number;
	minimumStock: number;
	isLowStock: boolean;
	workersWithStock: number;
}

export interface StockSummaryResponse {
	summary: {
		totalProducts: number;
		lowStockProducts: number;
		outOfStockProducts: number;
		totalWarehouseStock: number;
		totalWorkerStock: number;
	};
	products: StockSummaryProductItem[];
}

export interface PendingPaymentsReportResponse {
	summary: {
		totalCount: number;
		totalPending: number;
		fullyPending: number;
		partiallyPaid: number;
	};
	breakdown: Array<{
		_id: string;
		count: number;
		totalPending: number;
		sales: Array<{
			saleId: string;
			invoiceNo: string;
			customerName: string;
			customerPhone?: string;
			total: number;
			paidAmount: number;
			pendingAmount: number;
			createdAt: string;
		}>;
	}>;
}

export const reportService = {
	getSalesSummary: async (
		period: ReportPeriod = "month",
	): Promise<SalesSummaryResponse> => {
		const response = await apiClient.get<SalesSummaryResponse>(
			`/reports/sales-summary?period=${period}`,
		);
		return response.data;
	},

	getWorkerPerformance: async (
		period: ReportPeriod = "month",
	): Promise<WorkerPerformanceResponse> => {
		const response = await apiClient.get<WorkerPerformanceResponse>(
			`/reports/worker-performance?period=${period}`,
		);
		return response.data;
	},

	getProductSales: async (
		period: ReportPeriod = "month",
	): Promise<ProductSalesReportResponse> => {
		const response = await apiClient.get<ProductSalesReportResponse>(
			`/reports/product-sales?period=${period}`,
		);
		return response.data;
	},

	getStockSummary: async (): Promise<StockSummaryResponse> => {
		const response = await apiClient.get<StockSummaryResponse>(
			"/reports/stock-summary",
		);
		return response.data;
	},

	getPendingPayments: async (): Promise<PendingPaymentsReportResponse> => {
		const response = await apiClient.get<PendingPaymentsReportResponse>(
			"/reports/pending-payments",
		);
		return response.data;
	},
};
