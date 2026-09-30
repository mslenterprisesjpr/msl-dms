import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface IOrder {
	_id: string;
	orgId: string;
	orderNo: string;
	customerId: string;
	workerId: string;
	orderDate: Date;
	expectedDeliveryDate?: Date;
	status: "PENDING" | "PARTIAL" | "DELIVERED" | "CANCELLED";
	deliveryType: "IMMEDIATE" | "LATER";
	subtotal: number;
	discount: number;
	total: number;
	saleId?: string;
	note?: string;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

const OrderSchema = new Schema(
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

		orderNo: {
			type: String,
			required: true,
			// Example: ORD-2024-0001
		},

		customerId: {
			type: String,
			ref: "Customer",
			required: true,
		},

		workerId: {
			type: String,
			required: true,
			index: true,
			// Worker jo market se order laya
		},

		orderDate: {
			type: Date,
			default: Date.now,
			// Jis din order liya
		},

		expectedDeliveryDate: {
			type: Date,
			// Kab deliver karna hai
		},

		status: {
			type: String,
			enum: [
				"PENDING", // Order collected from market
				"PARTIAL", // Partially delivered (kuch maal nahi tha)
				"DELIVERED", // Fully delivered
				"CANCELLED", // Cancel ho gaya
			],
			default: "PENDING",
		},

		deliveryType: {
			type: String,
			enum: ["IMMEDIATE", "LATER"],
			default: "IMMEDIATE",
			// IMMEDIATE: Worker ke paas stock hai, turant deliver
			// LATER: Stock nahi hai, baad me deliver karenge
		},

		subtotal: {
			type: Number,
			default: 0,
			min: 0,
		},

		discount: {
			type: Number,
			default: 0,
			min: 0,
		},

		total: {
			type: Number,
			default: 0,
			min: 0,
		},

		saleId: {
			type: String,
			ref: "Sale",
			// Order deliver hone ke baad sale ban jati hai
		},

		note: {
			type: String,
			// Special instructions
			// Example: "Evening me deliver karna", "Cash only"
		},

		createdBy: {
			type: String,
			required: true,
			// Worker ka naam jo order laya
		},
	},
	{
		timestamps: true,
	},
);

OrderSchema.index({ orgId: 1, orderNo: 1 }, { unique: true });
OrderSchema.index({ workerId: 1, status: 1 });
OrderSchema.index({ status: 1, orderDate: -1 });

export const Order = model<IOrder>("Order", OrderSchema);
