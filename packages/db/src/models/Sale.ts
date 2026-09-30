import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface ISale {
	_id: string;
	orgId: string;
	invoiceNo: string;
	orderId?: string;
	customerId: string;
	workerId: string;
	saleDate: Date;
	subtotal: number;
	discount: number;
	total: number;
	paidAmount: number;
	pendingAmount: number;
	paymentStatus: "PAID" | "PARTIAL" | "PENDING";
	status: "DRAFT" | "CONFIRMED" | "CANCELLED";
	note?: string;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

const SaleSchema = new Schema(
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

		invoiceNo: {
			type: String,
			required: true,
		},

		orderId: {
			type: String,
			ref: "Order",
			// Optional: Agar order se sale bani hai toh link hogi
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
		},

		saleDate: {
			type: Date,
			default: Date.now,
		},

		subtotal: {
			type: Number,
			required: true,
			min: 0,
		},

		discount: {
			type: Number,
			default: 0,
			min: 0,
		},

		total: {
			type: Number,
			required: true,
			min: 0,
		},

		paidAmount: {
			type: Number,
			default: 0,
			min: 0,
		},

		pendingAmount: {
			type: Number,
			default: 0,
			min: 0,
		},

		paymentStatus: {
			type: String,
			enum: ["PAID", "PARTIAL", "PENDING"],
			default: "PENDING",
		},

		status: {
			type: String,
			enum: ["DRAFT", "CONFIRMED", "CANCELLED"],
			default: "DRAFT",
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

SaleSchema.index({ orgId: 1, invoiceNo: 1 }, { unique: true });

export const Sale = model<ISale>("Sale", SaleSchema);
