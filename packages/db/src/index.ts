import { MongoClient } from "mongodb";
import mongoose from "mongoose";

import type { DatabaseConfig } from "./config";

let mongoClient: MongoClient | null = null;

export async function createDb(env: DatabaseConfig) {
	// For Mongoose models
	await mongoose.connect(env.DATABASE_URL, {
		dbName: env.DATABASE_NAME || "msl",
	});

	// For Better Auth - use native MongoDB driver
	mongoClient = new MongoClient(env.DATABASE_URL);
	await mongoClient.connect();

	const db = mongoClient.db(env.DATABASE_NAME || "msl");

	console.log("✅ Connected to MongoDB:", db.databaseName);

	return db;
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
// Export the MongoDB client for Better Auth transactions
export { mongoClient };
