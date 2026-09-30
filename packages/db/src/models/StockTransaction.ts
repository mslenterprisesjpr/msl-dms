import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface IStockTransaction {
	_id: string;
	orgId: string;
	productId: string;
	workerId?: string;
	type: "PURCHASE" | "ISSUE" | "SALE" | "RETURN" | "ADJUSTMENT";
	quantity: number;
	cases: number;
	units: number;
	referenceId?: string;
	note?: string;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
	// Virtuals
	quantityDisplay?: string;
}

const StockTransactionSchema = new Schema(
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

		productId: {
			type: String,
			ref: "Product",
			required: true,
		},

		workerId: {
			type: String,
			index: true,
		},

		type: {
			type: String,
			enum: ["PURCHASE", "ISSUE", "SALE", "RETURN", "ADJUSTMENT"],
			required: true,
		},

		quantity: {
			type: Number,
			required: true,
			min: 1,
			// Total quantity in individual units (bottles/pieces)
		},

		// Optional: Store user input separately for display
		cases: {
			type: Number,
			default: 0,
			min: 0,
			// Number of cases entered by user
		},

		units: {
			type: Number,
			default: 0,
			min: 0,
			// Remaining units entered by user (e.g., 8 bottles)
		},

		referenceId: {
			type: String,
		},

		note: {
			type: String,
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

// Index for faster queries
StockTransactionSchema.index({ orgId: 1, type: 1, createdAt: -1 });
StockTransactionSchema.index({ workerId: 1, createdAt: -1 });

// Virtual to display transaction quantity
StockTransactionSchema.virtual("quantityDisplay").get(function () {
	if (this.cases > 0 && this.units > 0) {
		return `${this.cases} Cases + ${this.units} Units`;
	}
	if (this.cases > 0) {
		return `${this.cases} Cases`;
	}
	if (this.units > 0) {
		return `${this.units} Units`;
	}
	// Fallback: calculate from total quantity if cases/units not stored
	return `${this.quantity} Units`;
});

StockTransactionSchema.set("toJSON", { virtuals: true });
StockTransactionSchema.set("toObject", { virtuals: true });

export const StockTransaction = model<IStockTransaction>(
	"StockTransaction",
	StockTransactionSchema,
);
