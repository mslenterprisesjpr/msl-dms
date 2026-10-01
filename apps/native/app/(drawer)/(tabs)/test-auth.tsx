import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Button, Card, Typography } from "heroui-native";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { Container } from "@/components/container";
import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function TestAuthScreen() {
	const [logs, setLogs] = useState<string[]>([]);
	const { data: session } = authClient.useSession();
	const STORAGE_PREFIX = Constants.expoConfig?.scheme || "msl";

	const addLog = (message: string) => {
		setLogs((prev) => [
			...prev,
			`${new Date().toLocaleTimeString()}: ${message}`,
		]);
	};

	const testSecureStore = async () => {
		addLog("=== Testing Better Auth getCookie() ===");
		try {
			// Per Better Auth docs: use authClient.getCookie() for authenticated requests
			const cookies = await authClient.getCookie();

			if (cookies) {
				addLog("✅ Cookies Found via authClient.getCookie()");
				addLog(`Cookies: ${cookies.substring(0, 50)}...`);
			} else {
				addLog("❌ No cookies returned from authClient.getCookie()");
				addLog("💡 This means Better Auth hasn't stored session cookies");
			}

			addLog("");
			addLog("=== Checking Raw SecureStore (Debug) ===");
			addLog(`Storage Prefix: ${STORAGE_PREFIX}`);

			// Try multiple possible keys for debugging
			const possibleKeys = [
				`${STORAGE_PREFIX}_cookie`,
				`${STORAGE_PREFIX}_session_data`,
				`${STORAGE_PREFIX}_better-auth_session_token`,
				`${STORAGE_PREFIX}.better-auth.session-token`,
				"better-auth.session_token",
				`${STORAGE_PREFIX}_session`,
				`${STORAGE_PREFIX}.session`,
				"msl_better-auth_session_token",
				"msl.better-auth.session-token",
				"better-auth.session_token", // exact cookie name
			];

			let tokenFound = false;
			for (const key of possibleKeys) {
				const token = await SecureStore.getItemAsync(key);
				if (token) {
					addLog(`✅ Found at: ${key}`);
					addLog(`Token: ${token.substring(0, 30)}...`);
					tokenFound = true;
					break;
				}
			}

			if (!tokenFound) {
				addLog("❌ Token not found in any key");
			}
		} catch (error: any) {
			addLog(`❌ Error: ${error.message}`);
		}
	};

	const testAPICall = async () => {
		addLog("=== Testing API Call ===");
		try {
			const response = await apiClient.get("/products");
			addLog(`✅ Success: ${response.data?.data?.length || 0} products`);
		} catch (error: any) {
			addLog(`❌ Error: ${error.response?.status || error.message}`);
		}
	};

	const testSession = () => {
		addLog("=== Testing Session ===");
		if (session) {
			addLog("✅ Session Found");
			addLog(`User: ${session.user?.email || "Unknown"}`);
			addLog(`User ID: ${session.user?.id || "Unknown"}`);
			addLog(
				`Active Org ID: ${(session.session as any)?.activeOrganizationId || "❌ Not Set"}`,
			);
		} else {
			addLog("❌ No Session");
		}
	};

	const handleLogout = async () => {
		addLog("=== Logging Out ===");
		try {
			// Logout from Better Auth (will clear SecureStore automatically)
			await authClient.signOut();
			addLog("✅ Logged out from Better Auth");
			addLog("💡 Now login again to test token persistence!");
		} catch (error: any) {
			addLog(`❌ Error: ${error.message}`);
		}
	};

	const setupOrganization = async () => {
		addLog("=== Setting Up Organization ===");
		try {
			// Check if user has organizations
			const { data: orgs, error: listError } =
				await authClient.organization.list();

			if (listError) {
				addLog(`❌ Failed to list organizations: ${listError.message}`);
				return;
			}

			if (!orgs || orgs.length === 0) {
				addLog("No organizations found. Creating one...");

				// Create default organization
				const { data: newOrg, error: createError } =
					await authClient.organization.create({
						name: "My Organization",
						slug: `org-${Date.now()}`,
					});

				if (createError) {
					addLog(`❌ Failed to create organization: ${createError.message}`);
					return;
				}

				addLog(`✅ Organization created: ${newOrg?.name}`);
				addLog(`Organization ID: ${newOrg?.id}`);

				// Set as active
				if (newOrg) {
					const { error: setActiveError } =
						await authClient.organization.setActive({
							organizationId: newOrg.id,
						});

					if (setActiveError) {
						addLog(`❌ Failed to set active: ${setActiveError.message}`);
					} else {
						addLog("✅ Organization set as active in Better Auth!");

						// IMPORTANT: Also update Zustand store for API calls
						const { setCurrentOrg, setOrganizations } =
							useOrganizationStore.getState();
						setOrganizations([newOrg]);
						setCurrentOrg(newOrg.id);
						addLog("✅ Organization set in Zustand store (for API headers)!");
					}
				}
			} else {
				addLog(`Found ${orgs.length} organization(s)`);
				addLog(`First org: ${orgs[0].name} (${orgs[0].id})`);

				// Set first org as active
				const { error: setActiveError } =
					await authClient.organization.setActive({
						organizationId: orgs[0].id,
					});

				if (setActiveError) {
					addLog(`❌ Failed to set active: ${setActiveError.message}`);
				} else {
					addLog("✅ Organization set as active in Better Auth!");

					// IMPORTANT: Also update Zustand store for API calls
					const { setCurrentOrg, setOrganizations } =
						useOrganizationStore.getState();
					setOrganizations(orgs);
					setCurrentOrg(orgs[0].id);
					addLog("✅ Organization set in Zustand store (for API headers)!");
				}
			}
		} catch (error: any) {
			addLog(`❌ Error: ${error.message}`);
		}
	};

	const clearLogs = () => setLogs([]);

	return (
		<Container className="flex-1 p-4">
			<Card className="mb-4 p-4">
				<Typography variant="title2" className="mb-4">
					Auth Debug Tool
				</Typography>

				<View className="gap-2">
					<Button onPress={testSession}>1. Test Session</Button>
					<Button onPress={testSecureStore}>2. Test Cookies (getCookie)</Button>
					<Button onPress={testAPICall}>3. Test API Call</Button>
					<Button variant="success" onPress={setupOrganization}>
						🏢 Setup Organization
					</Button>
					<Button variant="danger" onPress={handleLogout}>
						🚪 Logout & Relogin Fresh
					</Button>
					<Button variant="outline" onPress={clearLogs}>
						Clear Logs
					</Button>
				</View>
			</Card>

			<Card className="flex-1 p-4">
				<Typography variant="title3" className="mb-2">
					Logs:
				</Typography>
				<ScrollView>
					{logs.map((log, index) => (
						<Typography
							key={index}
							variant="caption"
							className="mb-1 font-mono text-xs"
						>
							{log}
						</Typography>
					))}
					{logs.length === 0 && (
						<Typography variant="body" className="text-gray-500">
							No logs yet. Run tests above.
						</Typography>
					)}
				</ScrollView>
			</Card>
		</Container>
	);
}
