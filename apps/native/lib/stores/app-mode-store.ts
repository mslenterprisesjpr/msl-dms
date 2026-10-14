import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppMode = "admin" | "worker";

interface AppModeState {
	mode: AppMode;
	setMode: (mode: AppMode) => void;
	toggleMode: () => void;
}

export const useAppModeStore = create<AppModeState>()(
	persist(
		(set, get) => ({
			mode: "admin",
			setMode: (mode) => set({ mode }),
			toggleMode: () =>
				set({ mode: get().mode === "admin" ? "worker" : "admin" }),
		}),
		{
			name: "msl-app-mode-storage",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
