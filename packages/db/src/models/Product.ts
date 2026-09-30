import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface IProduct {
	_id: string;
	orgId: string;
	name: string;
	sku: string;
	category?: string;
	packSize: string;
	unit: "BOTTLE" | "PIECE" | "KG" | "LITER" | "PACKET";
	unitsPerCase: number;
	purchaseRate: number;
	sellingRate: number;
	minimumStock: number;
	gstRate: number;
	stock: number;
	image?: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	// Virtuals
	stockInCases?: number;
	remainingUnits?: number;
	stockDisplay?: string;
}

const ProductSchema = new Schema(
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

		sku: {
			type: String,
			required: true,
			trim: true,
		},

		category: {
			type: String,
			trim: true,
		},

		packSize: {
			type: String,
			required: true,
			trim: true,
			// Example: "250ml", "500ml", "1L"
		},

		unit: {
			type: String,
			required: true,
			enum: ["BOTTLE", "PIECE", "KG", "LITER", "PACKET"],
			default: "BOTTLE",
		},

		unitsPerCase: {
			type: Number,
			required: true,
			min: 1,
			default: 1,
			// Example: 24 bottles per case
		},

		purchaseRate: {
			type: Number,
			required: true,
			min: 0,
			// Purchase price per case
		},

		sellingRate: {
			type: Number,
			required: true,
			min: 0,
			// Selling price per case
		},

		minimumStock: {
			type: Number,
			default: 0,
			min: 0,
			// Minimum stock in cases
		},

		gstRate: {
			type: Number,
			default: 0,
			min: 0,
			max: 100,
			// GST percentage (e.g., 18 for 18%)
		},

		// Stock tracking in bottles/units (not cases)
		stock: {
			type: Number,
			default: 0,
			min: 0,
			// Total stock in individual units (bottles)
		},

		image: {
			type: String,
			trim: true,
			// Optional: Product image URL
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

ProductSchema.index({ orgId: 1, sku: 1 }, { unique: true });

// Virtual field to get stock in cases
ProductSchema.virtual("stockInCases").get(function () {
	return Math.floor(this.stock / this.unitsPerCase);
});

// Virtual field to get remaining bottles after cases
ProductSchema.virtual("remainingUnits").get(function () {
	return this.stock % this.unitsPerCase;
});

// Virtual to display stock as "X Cases + Y Bottles"
ProductSchema.virtual("stockDisplay").get(function () {
	const cases = Math.floor(this.stock / this.unitsPerCase);
	const remaining = this.stock % this.unitsPerCase;

	if (remaining > 0) {
		return `${cases} Cases + ${remaining} ${this.unit}s`;
	}
	return `${cases} Cases`;
});

// Enable virtuals in JSON
ProductSchema.set("toJSON", { virtuals: true });
ProductSchema.set("toObject", { virtuals: true });

export const Product = model<IProduct>("Product", ProductSchema);
