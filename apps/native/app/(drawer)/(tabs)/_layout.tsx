import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

export const unstable_settings = {
	initialRouteName: "(home)",
};

export default function TabLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const themeColorMuted = useThemeColor("muted");
	const themeColorAccent = useThemeColor("accent");

	return (
		<Tabs
			screenOptions={{
				headerShown: false, // All headers are rendered consistently by each tab's Stack
				tabBarActiveTintColor: themeColorAccent,
				tabBarInactiveTintColor: themeColorMuted,
				tabBarStyle: {
					backgroundColor: themeColorBackground,
					borderTopColor: "rgba(0,0,0,0.06)",
					paddingTop: 4,
				},
				tabBarLabelStyle: {
					fontSize: 11,
					fontWeight: "600",
				},
			}}
		>
			<Tabs.Screen
				name="(home)"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							name={focused ? "home" : "home-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="billing"
				options={{
					title: "Billing",
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							name={focused ? "document-text" : "document-text-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="stock"
				options={{
					title: "Stock",
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							name={focused ? "cube" : "cube-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="reports"
				options={{
					title: "Reports",
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							name={focused ? "stats-chart" : "stats-chart-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: "Settings",
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							name={focused ? "settings" : "settings-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="organizations"
				options={{
					href: null,
				}}
			/>
			<Tabs.Screen
				name="test-auth"
				options={{
					href: null,
				}}
			/>
		</Tabs>
	);
}
