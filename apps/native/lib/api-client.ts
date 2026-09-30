import axios from "axios";

import { ENV } from "@/src/env";

export const apiClient = axios.create({
	baseURL: ENV.EXPO_PUBLIC_SERVER_URL,
	timeout: 30000,
	headers: {
		"Content-Type": "application/json",
	},
	withCredentials: true,
});

// Request interceptor for adding auth tokens or logging
apiClient.interceptors.request.use(
	(config) => {
		// Add any request transformations here
		console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
		return config;
	},
	(error) => {
		console.error("API Request Error:", error);
		return Promise.reject(error);
	},
);

// Response interceptor for handling errors globally
apiClient.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		console.error("API Response Error:", error.response?.data || error.message);

		// Handle specific error cases
		if (error.response) {
			// Server responded with error
			const status = error.response.status;
			const message = error.response.data?.message || error.message;

			switch (status) {
				case 401:
					// Unauthorized - handle auth errors
					console.log("Unauthorized access - redirect to login");
					break;
				case 403:
					// Forbidden
					console.log("Access forbidden");
					break;
				case 404:
					// Not found
					console.log("Resource not found");
					break;
				case 500:
					// Server error
					console.log("Server error");
					break;
				default:
					console.log(`Error ${status}: ${message}`);
			}
		} else if (error.request) {
			// Request made but no response
			console.log("No response from server - check network");
		} else {
			// Something else happened
			console.log("Request setup error:", error.message);
		}

		return Promise.reject(error);
	},
);
