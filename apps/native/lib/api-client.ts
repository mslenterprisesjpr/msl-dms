import axios from "axios";
import { authClient } from "./auth-client";
import { useOrganizationStore } from "./stores/organization-store";

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000";

export const apiClient = axios.create({
	baseURL: `${API_URL}/api`,
	timeout: 10000,
	headers: {
		"Content-Type": "application/json",
	},
});

// Request interceptor - add auth cookie and org header
apiClient.interceptors.request.use(
	async (config) => {
		const cookies = await authClient.getCookie();

		if (cookies) {
			config.headers.Cookie = cookies;
		}

		// Add organization ID header
		const currentOrgId = useOrganizationStore.getState().currentOrgId;
		if (currentOrgId) {
			config.headers["x-organization-id"] = currentOrgId;
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
