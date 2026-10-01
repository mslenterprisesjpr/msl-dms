import { useCallback, useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export function useOrganizations() {
	const { setOrganizations, setLoading, organizations, currentOrgId } =
		useOrganizationStore();

	const fetchOrganizations = useCallback(async () => {
		setLoading(true);
		try {
			console.log("=== FETCHING ORGANIZATIONS ===");
			// Use Better Auth organization plugin method
			const { data, error } = await authClient.organization.list();

			console.log("Fetch response - data:", data);
			console.log("Fetch response - error:", error);

			if (error) {
				console.log("Organization list error:", error.message);
				setOrganizations([]);
				return;
			}

			// Better Auth returns organizations directly in data, not data.organizations
			const orgs = Array.isArray(data) ? data : [];

			console.log("Setting organizations:", orgs.length, "orgs");
			console.log("Organizations:", JSON.stringify(orgs, null, 2));
			setOrganizations(orgs);
		} catch (error) {
			// Network error or server not running - just show empty state
			console.log("Could not fetch organizations:", error);
			setOrganizations([]);
		} finally {
			setLoading(false);
			console.log("=== FETCH COMPLETE ===");
		}
	}, [setLoading, setOrganizations]);

	useEffect(() => {
		fetchOrganizations();
	}, [fetchOrganizations]);

	return {
		organizations,
		currentOrgId,
		refetch: fetchOrganizations,
	};
}
