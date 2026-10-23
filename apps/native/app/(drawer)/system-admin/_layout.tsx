import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SystemAdminTabsLayout() {
	const themeColorBackground = useThemeColor("background");
	const themeColorMuted = useThemeColor("muted");
	const themeColorAccent = useThemeColor("accent");
	const insets = useSafeAreaInsets();

	const bottomInset =
		insets.bottom > 0 ? insets.bottom : Platform.OS === "ios" ? 16 : 8;

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: themeColorAccent,
				tabBarInactiveTintColor: themeColorMuted,
				tabBarStyle: {
					backgroundColor: themeColorBackground,
					borderTopWidth: 1,
					borderTopColor: "rgba(0,0,0,0.06)",
					height: 56 + bottomInset,
					paddingTop: 6,
					paddingBottom: bottomInset,
				},
				tabBarItemStyle: {
					paddingVertical: 2,
				},
				tabBarLabelStyle: {
					fontSize: 11,
					fontWeight: "700",
					letterSpacing: 0.1,
					marginTop: 2,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Overview",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "speedometer" : "speedometer-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="organizations"
				options={{
					title: "Agencies",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "business" : "business-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="users"
				options={{
					title: "Users",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "people" : "people-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="telemetry"
				options={{
					title: "Server",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "server" : "server-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
