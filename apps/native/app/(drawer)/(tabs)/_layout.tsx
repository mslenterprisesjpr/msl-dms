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
				name="organizations"
				options={{
					title: "Organizations",
					headerTitle: "Organizations",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="business" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
