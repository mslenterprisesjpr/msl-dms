import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, Switch, Typography, useThemeColor } from "heroui-native";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useOrgUserRole } from "@/hooks/use-org-user-role";
import { useSession } from "@/lib/hooks/use-session";

export default function SettingsScreen() {
	const themeAccent = useThemeColor("accent");
	const { session, user } = useSession();
	const { isDark, toggleTheme } = useAppTheme();
	const { isOrgAdmin, isSystemAdmin, orgRole } = useOrgUserRole();
	const isAdmin = isOrgAdmin;

	const settingsOptions = [
		{
			icon: "shield-checkmark-outline" as const,
			title: "Platform Super Admin Console",
			description: "Global telemetry, SaaS metrics & tenant overview",
			route: "/(drawer)/system-admin",
			color: "#002B66",
			systemOnly: true,
		},
		{
			icon: "business-outline" as const,
			title: "Organizations",
			description: "Manage your organizations and members",
			route: "/organizations",
			color: "#3b82f6",
			adminOnly: true,
		},
		{
			icon: "print-outline" as const,
			title: "POS Thermal Printer",
			description: "Bluetooth 58mm / 80mm receipt printer",
			route: "/(drawer)/printer",
			color: "#0d9488",
		},
		{
			icon: "person-outline" as const,
			title: "Profile",
			description: "Update your personal information",
			route: "/settings/profile",
			color: "#10b981",
		},
	];

	const visibleOptions = settingsOptions.filter((option) => {
		if (option.systemOnly && !isSystemAdmin) return false;
		if (option.adminOnly && !isAdmin) return false;
		return true;
	});

	return (
		<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
				showsVerticalScrollIndicator={false}
			>
				{/* User Profile Card */}
				<Card className="mb-5 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center">
						<View className="h-14 w-14 items-center justify-center rounded-full bg-accent/10">
							<Ionicons name="person" size={28} color={themeAccent} />
						</View>
						<View className="ml-3.5 flex-1">
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								{user?.name || user?.email || "User"}
							</Text>
							<Text className="text-slate-500 text-xs dark:text-zinc-400">
								{user?.email}
							</Text>
							<View className="mt-1 flex-row items-center">
								<View className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-zinc-800">
									<Text className="font-bold text-[10px] text-slate-600 uppercase dark:text-zinc-300">
										Role: {user?.role || "Member"}
									</Text>
								</View>
							</View>
						</View>
					</View>
				</Card>

				{/* Other Settings Options */}
				<Text className="mb-2.5 font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
					Management & Preferences
				</Text>
				<View className="mb-6 gap-2.5">
					{visibleOptions.map((option) => (
						<Pressable
							key={option.route}
							onPress={() => router.push(option.route as any)}
						>
							<Card className="border border-slate-100 bg-white p-3.5 shadow-sm active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900">
								<View className="flex-row items-center">
									<View
										className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
										style={{ backgroundColor: `${option.color}15` }}
									>
										<Ionicons
											name={option.icon}
											size={20}
											color={option.color}
										/>
									</View>
									<View className="flex-1">
										<Text className="font-semibold text-slate-900 text-sm dark:text-white">
											{option.title}
										</Text>
										<Text className="text-slate-500 text-xs dark:text-zinc-400">
											{option.description}
										</Text>
									</View>
									<Ionicons name="chevron-forward" size={18} color="#94a3b8" />
								</View>
							</Card>
						</Pressable>
					))}
				</View>

				{/* Theme Toggle Card */}
				<Card className="border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center">
							<View
								className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
								style={{ backgroundColor: isDark ? "#38bdf815" : "#0f274a10" }}
							>
								<Ionicons
									name={isDark ? "moon" : "moon-outline"}
									size={20}
									color={isDark ? "#38bdf8" : "#0f274a"}
								/>
							</View>
							<View>
								<Text className="font-semibold text-slate-900 text-sm dark:text-white">
									Dark Theme
								</Text>
								<Text className="text-slate-500 text-xs dark:text-zinc-400">
									{isDark ? "Dark theme active" : "Light theme active"}
								</Text>
							</View>
						</View>
						<Switch
							isSelected={isDark}
							onSelectedChange={() => toggleTheme()}
						/>
					</View>
				</Card>
			</ScrollView>
		</Container>
	);
}
