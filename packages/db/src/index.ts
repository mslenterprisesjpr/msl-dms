import mongoose from "mongoose";

import type { DatabaseConfig } from "./config";

export async function createDb(env: DatabaseConfig) {
	await mongoose.connect(env.DATABASE_URL);
	return mongoose.connection.getClient().db();
}

export type Database = Awaited<ReturnType<typeof createDb>>;

// Export auth models
export * from "./models/auth.model";

// Export inventory models
export * from "./models/Customer";
export * from "./models/Order";
export * from "./models/OrderItem";
export * from "./models/Payment";
export * from "./models/Product";
export * from "./models/Sale";
export * from "./models/SaleItem";
export * from "./models/StockTransaction";
export * from "./models/WorkerStock";
