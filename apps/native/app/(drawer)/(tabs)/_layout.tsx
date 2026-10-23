import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOrgUserRole } from "@/hooks/use-org-user-role";

export const unstable_settings = {
	initialRouteName: "(home)",
};

export default function TabLayout() {
	const themeColorBackground = useThemeColor("background");
	const themeColorMuted = useThemeColor("muted");
	const themeColorAccent = useThemeColor("accent");
	const insets = useSafeAreaInsets();
	const { isOrgAdmin } = useOrgUserRole();

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
				name="(home)"
				options={{
					title: "Home",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "home" : "home-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="billing"
				options={{
					title: "Billing",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "receipt" : "receipt-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="stock"
				options={{
					title: "Stock",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "cube" : "cube-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="reports"
				options={{
					title: "Reports",
					href: isOrgAdmin ? "/(drawer)/(tabs)/reports" : null,
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "stats-chart" : "stats-chart-outline"}
							size={22}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: "Settings",
					tabBarIcon: ({ color, focused }) => (
						<Ionicons
							name={focused ? "settings" : "settings-outline"}
							size={22}
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
		</Tabs>
	);
}
