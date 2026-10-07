import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";
import { useCallback } from "react";
import { Text } from "react-native";

import { CustomDrawerContent } from "@/components/drawer-content";
import { ThemeToggle } from "@/components/theme-toggle";

function DrawerLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const themeColorAccent = useThemeColor("accent");

	const renderThemeToggle = useCallback(() => <ThemeToggle />, []);

	return (
		<Drawer
			drawerContent={(props) => <CustomDrawerContent {...props} />}
			screenOptions={{
				headerTintColor: themeColorForeground,
				headerStyle: { backgroundColor: themeColorBackground },
				headerTitleStyle: {
					fontWeight: "600",
					color: themeColorForeground,
				},
				drawerActiveTintColor: themeColorAccent,
				headerRight: renderThemeToggle,
				drawerStyle: { backgroundColor: themeColorBackground },
			}}
		>
			<Drawer.Screen
				name="(tabs)"
				options={{
					headerShown: false, // Tabs will show their own headers with drawer button
					drawerLabel: ({ color, focused }) => (
						<Text style={{ color: focused ? color : themeColorForeground }}>
							Tabs
						</Text>
					),
					drawerIcon: ({ size, color, focused }) => (
						<MaterialIcons
							name="border-bottom"
							size={size}
							color={focused ? color : themeColorForeground}
						/>
					),
				}}
			/>
			<Drawer.Screen
				name="second"
				options={{
					headerTitle: "Second",
					drawerLabel: ({ color, focused }) => (
						<Text style={{ color: focused ? color : themeColorForeground }}>
							Second
						</Text>
					),
					drawerIcon: ({ size, color, focused }) => (
						<Ionicons
							name="home-outline"
							size={size}
							color={focused ? color : themeColorForeground}
						/>
					),
				}}
			/>
		</Drawer>
	);
}

export default DrawerLayout;
