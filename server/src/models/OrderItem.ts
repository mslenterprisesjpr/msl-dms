import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface IOrderItem {
	_id: string;
	orderId: string;
	productId: string;
	quantity: number;
	deliveredQuantity: number;
	pendingQuantity: number;
	cases: number;
	units: number;
	deliveredCases: number;
	deliveredUnits: number;
	price: number;
	total: number;
	createdAt: Date;
	updatedAt: Date;
	// Virtuals
	quantityDisplay?: string;
	deliveredDisplay?: string;
	isFullyDelivered?: boolean;
	isPartiallyDelivered?: boolean;
}

const OrderItemSchema = new Schema(
	{
		_id: {
			type: String,
			default: () => generateId(),
		},

		orderId: {
			type: String,
			ref: "Order",
			required: true,
			index: true,
		},

		productId: {
			type: String,
			ref: "Product",
			required: true,
		},

		quantity: {
			type: Number,
			required: true,
			min: 1,
			// Total quantity ordered (in bottles)
		},

		deliveredQuantity: {
			type: Number,
			default: 0,
			min: 0,
			// Kitna deliver ho gaya
		},

		pendingQuantity: {
			type: Number,
			default: 0,
			min: 0,
			// Kitna baaki hai
		},

		cases: {
			type: Number,
			default: 0,
			min: 0,
			// Ordered cases
		},

		units: {
			type: Number,
			default: 0,
			min: 0,
			// Ordered units
		},

		deliveredCases: {
			type: Number,
			default: 0,
			min: 0,
			// Delivered cases
		},

		deliveredUnits: {
			type: Number,
			default: 0,
			min: 0,
			// Delivered units
		},

		price: {
			type: Number,
			required: true,
			min: 0,
		},

		total: {
			type: Number,
			required: true,
			min: 0,
		},
	},
	{
		timestamps: true,
	},
);

// Virtual to display quantity
OrderItemSchema.virtual("quantityDisplay").get(function () {
	if (this.cases > 0 && this.units > 0) {
		return `${this.cases} Cases + ${this.units} Units`;
	}
	if (this.cases > 0) {
		return `${this.cases} Cases`;
	}
	if (this.units > 0) {
		return `${this.units} Units`;
	}
	return `${this.quantity} Units`;
});

// Virtual to display delivered quantity
OrderItemSchema.virtual("deliveredDisplay").get(function () {
	if (this.deliveredCases > 0 && this.deliveredUnits > 0) {
		return `${this.deliveredCases} Cases + ${this.deliveredUnits} Units`;
	}
	if (this.deliveredCases > 0) {
		return `${this.deliveredCases} Cases`;
	}
	if (this.deliveredUnits > 0) {
		return `${this.deliveredUnits} Units`;
	}
	return `${this.deliveredQuantity} Units`;
});

// Virtual to check if fully delivered
OrderItemSchema.virtual("isFullyDelivered").get(function () {
	return this.deliveredQuantity >= this.quantity;
});

// Virtual to check if partially delivered
OrderItemSchema.virtual("isPartiallyDelivered").get(function () {
	return this.deliveredQuantity > 0 && this.deliveredQuantity < this.quantity;
});

OrderItemSchema.set("toJSON", { virtuals: true });
OrderItemSchema.set("toObject", { virtuals: true });

export const OrderItem = model<IOrderItem>("OrderItem", OrderItemSchema);
