import { generateId } from "@msl/id";
import { model, Schema } from "mongoose";

export interface IWorkerStock {
	_id: string;
	orgId: string;
	workerId: string;
	productId: string;
	quantity: number;
	createdAt: Date;
	updatedAt: Date;
	// Virtuals
	stockInCases?: number;
	remainingUnits?: number;
}

const WorkerStockSchema = new Schema(
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

		workerId: {
			type: String,
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
			default: 0,
			min: 0,
			// Total quantity in individual units (bottles/pieces)
		},
	},
	{
		timestamps: true,
	},
);

WorkerStockSchema.index(
	{ orgId: 1, workerId: 1, productId: 1 },
	{ unique: true },
);

// Virtual fields for display
WorkerStockSchema.virtual("stockInCases").get(function () {
	if (!this.populated("productId")) return null;
	const product = this.productId as any;
	return Math.floor(this.quantity / product.unitsPerCase);
});

WorkerStockSchema.virtual("remainingUnits").get(function () {
	if (!this.populated("productId")) return null;
	const product = this.productId as any;
	return this.quantity % product.unitsPerCase;
});

WorkerStockSchema.set("toJSON", { virtuals: true });
WorkerStockSchema.set("toObject", { virtuals: true });

export const WorkerStock = model<IWorkerStock>(
	"WorkerStock",
	WorkerStockSchema,
);
