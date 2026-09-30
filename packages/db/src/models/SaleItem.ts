import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface ISaleItem {
	_id: string;
	saleId: string;
	productId: string;
	quantity: number;
	cases: number;
	units: number;
	price: number;
	total: number;
	createdAt: Date;
	updatedAt: Date;
	// Virtuals
	quantityDisplay?: string;
}

const SaleItemSchema = new Schema(
	{
		_id: {
			type: String,
			default: () => generateId(),
		},

		saleId: {
			type: String,
			ref: "Sale",
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
			// Total quantity in individual units (bottles)
		},

		// Store user input for display
		cases: {
			type: Number,
			default: 0,
			min: 0,
		},

		units: {
			type: Number,
			default: 0,
			min: 0,
		},

		price: {
			type: Number,
			required: true,
			min: 0,
			// Price per case or per unit
		},

		total: {
			type: Number,
			required: true,
			min: 0,
			// quantity × price
		},
	},
	{
		timestamps: true,
	},
);

// Virtual to display quantity
SaleItemSchema.virtual("quantityDisplay").get(function () {
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

SaleItemSchema.set("toJSON", { virtuals: true });
SaleItemSchema.set("toObject", { virtuals: true });

export const SaleItem = model<ISaleItem>("SaleItem", SaleItemSchema);
