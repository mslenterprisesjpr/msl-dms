export interface Customer {
	_id: string;
	orgId: string;
	name: string;
	phone?: string;
	address?: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateCustomerDto {
	name: string;
	phone?: string;
	address?: string;
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
