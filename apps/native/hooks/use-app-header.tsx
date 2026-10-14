import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type React from "react";
import { Pressable, useColorScheme } from "react-native";

export function useAppHeader() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";

	const navigation = useNavigation();
	const router = useRouter();

	const commonScreenOptions = {
		headerShown: true,
		headerStyle: {
			backgroundColor: themeColorBackground,
			elevation: 0,
			shadowOpacity: 0,
			borderBottomWidth: 1,
			borderBottomColor: isDark
				? "rgba(255, 255, 255, 0.08)"
				: "rgba(0, 0, 0, 0.06)",
		},
		headerTintColor: themeColorForeground,
		headerTitleStyle: {
			color: themeColorForeground,
			fontWeight: "700" as const,
			fontSize: 18,
		},
		headerTitleAlign: "left" as const,
	};

	const rootTabHeaderOptions = (title: string) => ({
		...commonScreenOptions,
		headerTitle: title,
		headerLeft: () => (
			<Pressable
				onPress={() => {
					// @ts-expect-error - drawer navigation type
					if (typeof navigation.openDrawer === "function") {
						// @ts-expect-error - drawer navigation type
						navigation.openDrawer();
					} else {
						(navigation as any).dispatch?.({ type: "OPEN_DRAWER" });
					}
				}}
				className="p-1"
				hitSlop={12}
			>
				<Ionicons name="menu" size={24} color={themeColorForeground} />
			</Pressable>
		),
		headerRight: () => (
			<Pressable
				onPress={() => {
					// Notification handler
				}}
				className="p-1"
				hitSlop={12}
			>
				<Ionicons
					name="notifications-outline"
					size={22}
					color={themeColorForeground}
				/>
			</Pressable>
		),
	});

	const detailHeaderOptions = (
		title: string,
		rightComponent?: React.ReactNode,
	) => ({
		...commonScreenOptions,
		headerTitle: title,
		headerLeft: () => (
			<Pressable onPress={() => router.back()} className="p-1" hitSlop={12}>
				<Ionicons name="arrow-back" size={24} color={themeColorForeground} />
			</Pressable>
		),
		headerRight: rightComponent ? () => rightComponent : undefined,
	});

	return {
		themeColorForeground,
		themeColorBackground,
		commonScreenOptions,
		rootTabHeaderOptions,
		detailHeaderOptions,
	};
}
