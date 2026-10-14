import "@/global.css";
import { Stack } from "expo-router";
import * as ExpoSplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ThemedStatusBar } from "@/components/themed-status-bar";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { QueryProvider } from "@/lib/query-client";

// Prevent native splash screen from auto hiding before app is ready
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
	initialRouteName: "(drawer)",
};

function StackLayout() {
	return (
		<Stack screenOptions={{}}>
			<Stack.Screen name="(drawer)" options={{ headerShown: false }} />
			<Stack.Screen name="(auth)" options={{ headerShown: false }} />
			<Stack.Screen
				name="modal"
				options={{ title: "Modal", presentation: "modal" }}
			/>
		</Stack>
	);
}

export default function Layout() {
	useEffect(() => {
		const hideSplash = async () => {
			try {
				await ExpoSplashScreen.hideAsync();
			} catch {
				// Ignore if already hidden
			}
		};
		hideSplash();
	}, []);

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<KeyboardProvider>
				<QueryProvider>
					<AppThemeProvider>
						<HeroUINativeProvider>
							<ThemedStatusBar />
							<StackLayout />
						</HeroUINativeProvider>
					</AppThemeProvider>
				</QueryProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
