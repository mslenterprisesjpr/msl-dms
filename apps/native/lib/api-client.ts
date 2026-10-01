import axios from "axios";
import { authClient } from "./auth-client";

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000";

export const apiClient = axios.create({
	baseURL: `${API_URL}/api`,
	timeout: 10000,
	headers: {
		"Content-Type": "application/json",
	},
});

// Request interceptor - add auth cookie
apiClient.interceptors.request.use(
	async (config) => {
		const cookies = await authClient.getCookie();

		if (cookies) {
			config.headers.Cookie = cookies;
		}

		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		return Promise.reject(error);
	},
);
