export interface Customer {
	_id: string;
	orgId: string;
	name: string;
	phone?: string;
	address?: string;
	gstNumber?: string;
	image?: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateCustomerDto {
	name: string;
	phone?: string;
	address?: string;
	gstNumber?: string;
	image?: string;
	isActive?: boolean;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export interface CustomersQuery {
	search?: string;
	page?: number;
	limit?: number;
	isActive?: boolean;
}

export interface CustomersResponse {
	data: Customer[];
	pagination: {
		total: number;
		page: number;
		limit: number;
		pages: number;
	};
}

export interface CustomerLedgerTransaction {
	id: string;
	type: "INVOICE" | "PAYMENT";
	date: string;
	referenceNo: string;
	title: string;
	debit: number;
	credit: number;
	runningBalance: number;
	status?: "PAID" | "PARTIAL" | "PENDING";
	paidAmount?: number;
	pendingAmount?: number;
	paymentMethod?: string;
	note?: string;
	saleId?: string;
}

export interface CustomerLedgerSummary {
	totalBilled: number;
	totalPaid: number;
	totalPending: number;
	totalBillsCount: number;
	unpaidBillsCount: number;
}

export interface CustomerLedgerResponse {
	message: string;
	customer: Customer;
	summary: CustomerLedgerSummary;
	timeline: CustomerLedgerTransaction[];
	unpaidInvoices: any[];
}
