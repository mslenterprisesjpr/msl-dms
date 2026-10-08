import { initLogger } from "evlog";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { ENV } from "./env.server";
import { auth } from "./services";

initLogger({
	env: { service: "msl-server" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
	exclude: ["/api/auth/**"],
	maskEmail: true,
});

const app = new Hono<EvlogVariables>();

app.use(
	evlog({
		drain: process.env.NODE_ENV === "production" ? undefined : createFsDrain(),
	}),
);
app.use("*", async (c, next) => {
	await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
	await next();
});

app.use(
	"/*",
	cors({
		origin: ENV.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

import customerRoutes from "./routes/customer.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import orderRoutes from "./routes/order.routes";
import organizationRoutes from "./routes/organization.routes";
import paymentRoutes from "./routes/payment.routes";
// Routes
import productRoutes from "./routes/product.routes";
import reportRoutes from "./routes/report.routes";
import saleRoutes from "./routes/sale.routes";
import stockRoutes from "./routes/stock.routes";
import workerStockRoutes from "./routes/worker-stock.routes";

app.route("/api/organizations", organizationRoutes);
app.route("/api/products", productRoutes);
app.route("/api/customers", customerRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/stock", stockRoutes);
app.route("/api/worker-stock", workerStockRoutes);
app.route("/api/orders", orderRoutes);
app.route("/api/sales", saleRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/reports", reportRoutes);

app.get("/", (c) => {
	return c.text("OK");
});

import { serve } from "@hono/node-server";

export default app;

if (!process.env.VERCEL) {
	serve(
		{
			fetch: app.fetch,
			port: 3000,
		},
		(info) => {
			console.log(`Server is running on http://localhost:${info.port}`);
		},
	);
}
