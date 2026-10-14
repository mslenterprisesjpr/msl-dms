import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface ICustomer {
	_id: string;
	orgId: string;
	name: string;
	phone?: string;
	address?: string;
	gstNumber?: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const CustomerSchema = new Schema(
	{
		_id: {
			type: String,
			default: () => generateId(),
		},

		orgId: {
			type: String,
			required: true,
			index: true,
		},

		name: {
			type: String,
			required: true,
			trim: true,
		},

		phone: {
			type: String,
			trim: true,
		},

		address: {
			type: String,
			trim: true,
		},

		gstNumber: {
			type: String,
			trim: true,
			uppercase: true,
		},

		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
	},
);

export const Customer = model<ICustomer>("Customer", CustomerSchema);
