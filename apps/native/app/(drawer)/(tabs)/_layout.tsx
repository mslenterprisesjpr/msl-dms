import { Ionicons } from "@expo/vector-icons";
import { Tabs, useNavigation } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable } from "react-native";

export default function TabLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const navigation = useNavigation();

	return (
		<Tabs
			screenOptions={{
				headerShown: true,
				headerStyle: {
					backgroundColor: themeColorBackground,
				},
				headerTintColor: themeColorForeground,
				headerTitleStyle: {
					color: themeColorForeground,
					fontWeight: "600",
				},
				tabBarStyle: {
					backgroundColor: themeColorBackground,
				},
				headerLeft: () => (
					<Pressable
						onPress={() => {
							// @ts-expect-error - drawer navigation type
							navigation.openDrawer?.();
						}}
						className="ml-4"
					>
						<Ionicons name="menu" size={24} color={themeColorForeground} />
					</Pressable>
				),
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					headerTitle: "Home",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="home" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="products"
				options={{
					title: "Products",
					headerTitle: "Products",
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="cube" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="customers"
				options={{
					title: "Customers",
					headerTitle: "Customers",
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="people" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="worker-stock"
				options={{
					title: "My Stock",
					headerTitle: "Worker Stock",
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="briefcase" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: "Settings",
					headerTitle: "Settings",
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="settings" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="organizations"
				options={{
					href: null, // Hide from tabs, accessible via settings
				}}
			/>
			<Tabs.Screen
				name="settings/profile"
				options={{
					href: null, // Hide from tabs, accessible via settings
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="settings/users"
				options={{
					href: null, // Hide from tabs, accessible via settings
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="test-auth"
				options={{
					href: null, // Hide from tabs
				}}
			/>
		</Tabs>
	);
}
