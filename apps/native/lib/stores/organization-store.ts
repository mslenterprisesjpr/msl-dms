import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import {
	createJSONStorage,
	persist,
	type StateStorage,
} from "zustand/middleware";

export interface Organization {
	id: string;
	name: string;
	slug: string;
	logo?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
}

interface OrganizationStore {
	organizations: Organization[];
	currentOrgId: string | null;
	isLoading: boolean;

	// Actions
	setOrganizations: (orgs: Organization[]) => void;
	addOrganization: (org: Organization) => void;
	updateOrganization: (id: string, data: Partial<Organization>) => void;
	removeOrganization: (id: string) => void;
	setCurrentOrg: (orgId: string) => void;
	getCurrentOrg: () => Organization | null;
	clearOrganizations: () => void;
	setLoading: (loading: boolean) => void;
}

// Custom Expo SecureStore adapter for zustand persist
const expoSecureStorage: StateStorage = {
	getItem: async (name: string): Promise<string | null> => {
		try {
			const value = await SecureStore.getItemAsync(name);
			return value;
		} catch (error) {
			console.error("SecureStore getItem error:", error);
			return null;
		}
	},
	setItem: async (name: string, value: string): Promise<void> => {
		try {
			await SecureStore.setItemAsync(name, value);
		} catch (error) {
			console.error("SecureStore setItem error:", error);
		}
	},
	removeItem: async (name: string): Promise<void> => {
		try {
			await SecureStore.deleteItemAsync(name);
		} catch (error) {
			console.error("SecureStore removeItem error:", error);
		}
	},
};

export const useOrganizationStore = create<OrganizationStore>()(
	persist(
		(set, get) => ({
			organizations: [],
			currentOrgId: null,
			isLoading: false,

			setOrganizations: (orgs) => set({ organizations: orgs }),

			addOrganization: (org) =>
				set((state) => ({
					organizations: [...state.organizations, org],
				})),

			updateOrganization: (id, data) =>
				set((state) => ({
					organizations: state.organizations.map((org) =>
						org.id === id ? { ...org, ...data } : org,
					),
				})),

			removeOrganization: (id) =>
				set((state) => ({
					organizations: state.organizations.filter((org) => org.id !== id),
					currentOrgId: state.currentOrgId === id ? null : state.currentOrgId,
				})),

			setCurrentOrg: (orgId) => {
				console.log("Store: Setting current org to:", orgId);
				set({ currentOrgId: orgId });
			},

			getCurrentOrg: () => {
				const state = get();
				const org = state.organizations.find(
					(org) => org.id === state.currentOrgId,
				);
				console.log("Store: Getting current org:", org);
				return org || null;
			},

			clearOrganizations: () =>
				set({
					organizations: [],
					currentOrgId: null,
				}),

			setLoading: (loading) => set({ isLoading: loading }),
		}),
		{
			name: "organization-storage",
			storage: createJSONStorage(() => expoSecureStorage),
		},
	),
);
