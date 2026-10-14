import { Ionicons } from "@expo/vector-icons";
import { Tabs, useNavigation } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable } from "react-native";

export default function TabLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const themeColorMuted = useThemeColor("muted");
	const navigation = useNavigation();

	return (
		<Tabs
			screenOptions={{
				headerShown: true,
				headerStyle: {
					backgroundColor: themeColorBackground,
					elevation: 0,
					shadowOpacity: 0,
				},
				headerTintColor: themeColorForeground,
				headerTitleStyle: {
					color: themeColorForeground,
					fontWeight: "700",
					fontSize: 18,
				},
				headerTitleAlign: "left",
				tabBarActiveTintColor: "#f95a24",
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
				headerLeft: () => (
					<Pressable
						onPress={() => {
							// @ts-expect-error - drawer navigation type
							navigation.openDrawer?.();
						}}
						className="mr-2 ml-4"
						hitSlop={8}
					>
						<Ionicons name="menu" size={24} color={themeColorForeground} />
					</Pressable>
				),
				headerRight: () => (
					<Pressable
						onPress={() => {
							// Notification bell press
						}}
						className="mr-4 p-1"
						hitSlop={8}
					>
						<Ionicons
							name="notifications-outline"
							size={22}
							color={themeColorForeground}
						/>
					</Pressable>
				),
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					headerTitle: "Campa Distribution",
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
					headerShown: false,
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
					headerShown: false,
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
					headerShown: false,
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
					headerShown: false,
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
