import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type mongoose from "mongoose";
import type { ZodError } from "zod";

const isDev = process.env.NODE_ENV === "development";

interface ErrorResponse {
	status: ContentfulStatusCode;
	message: string;
}

const handleDuplicateKey = (err: any): ErrorResponse => {
	const field = Object.keys(err.keyValue || {})[0] || "field";
	const value = err.keyValue?.[field] || "";
	return { status: 409, message: `${field} '${value}' already exists` };
};

// Error handlers map
const handlers: Record<string, (err: any) => ErrorResponse> = {
	ZodError: (err: ZodError) => ({
		status: 400,
		message: `Validation failed: ${err.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join(", ")}`,
	}),

	CastError: (err: mongoose.Error.CastError) => ({
		status: 400,
		message: `Invalid ${err.path}: ${err.value}`,
	}),

	ValidationError: (err: mongoose.Error.ValidationError) => ({
		status: 400,
		message: Object.values(err.errors)
			.map((e) => e.message)
			.join(". "),
	}),

	PayloadTooLargeError: () => ({
		status: 413,
		message: "Request payload too large",
	}),
	JsonWebTokenError: () => ({ status: 401, message: "Invalid token" }),
	TokenExpiredError: () => ({ status: 401, message: "Token expired" }),
	TimeoutError: () => ({ status: 408, message: "Request timeout" }),
	SyntaxError: () => ({ status: 400, message: "Invalid JSON syntax" }),
	MongoNetworkError: () => ({
		status: 503,
		message: "Database connection failed",
	}),
};

/**
 * Global Error Handler for Hono
 */
export const globalErrorHandler = (err: Error, c: Context) => {
	// HTTPException
	if (err instanceof HTTPException) {
		console.error("HTTPException:", err.message, err.cause);
		return c.json(
			{ status: err.status, error: err.message },
			err.status as ContentfulStatusCode,
		);
	}

	const error = err as any;
	const status = (error.status ||
		error.statusCode ||
		500) as ContentfulStatusCode;

	// Development - full details
	if (isDev) {
		console.error(err);
		return c.json(
			{ status, error: error.message, stack: error.stack, name: error.name },
			status,
		);
	}

	// Production - clean errors
	const handler = handlers[error.name];
	let response: ErrorResponse;

	if (handler) {
		response = handler(error);
	} else if (error.code === 11000) {
		response = handleDuplicateKey(error);
	} else {
		response = { status: 500, message: "Internal Server Error" };
	}

	console.error("Error:", err.name, err.message);
	return c.json(
		{ status: response.status, error: response.message },
		response.status,
	);
};

/**
 * Not Found Handler for Hono
 */
export const notFoundHandler = (c: Context) => {
	return c.json({ status: 404, error: `Route ${c.req.path} not found` }, 404);
};
