import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface IPayment {
	_id: string;
	orgId: string;
	saleId: string;
	amount: number;
	paymentMethod: "CASH" | "UPI" | "CARD" | "CREDIT";
	paymentDate: Date;
	note?: string;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

const PaymentSchema = new Schema(
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

		saleId: {
			type: String,
			ref: "Sale",
			required: true,
			index: true,
		},

		amount: {
			type: Number,
			required: true,
			min: 0,
		},

		paymentMethod: {
			type: String,
			enum: ["CASH", "UPI", "CARD", "CREDIT"],
			required: true,
		},

		paymentDate: {
			type: Date,
			required: true,
		},

		note: {
			type: String,
			trim: true,
		},

		createdBy: {
			type: String,
			required: true,
		},
	},
	{
		timestamps: true,
	},
);

export const Payment = model<IPayment>("Payment", PaymentSchema);
