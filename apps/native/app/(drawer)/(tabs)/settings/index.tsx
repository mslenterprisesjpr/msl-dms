import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, Typography } from "heroui-native";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/hooks/use-session";
import { useAppModeStore } from "@/lib/stores/app-mode-store";

export default function SettingsScreen() {
	const { session, user } = useSession();
	const { mode, setMode } = useAppModeStore();

	const isAdminUser = user?.role === "admin";

	const settingsOptions = [
		{
			icon: "business-outline" as const,
			title: "Organizations",
			description: "Manage your organizations and members",
			route: "/organizations",
			color: "#3b82f6",
		},
		{
			icon: "people-outline" as const,
			title: "User Management",
			description: "Create and manage system users",
			route: "/settings/users",
			color: "#8b5cf6",
			adminOnly: true,
		},
		{
			icon: "person-outline" as const,
			title: "Profile",
			description: "Update your personal information",
			route: "/settings/profile",
			color: "#10b981",
		},
	];

	const visibleOptions = settingsOptions.filter(
		(option) => !option.adminOnly || isAdminUser || mode === "admin",
	);

	return (
		<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
				showsVerticalScrollIndicator={false}
			>
				{/* User Profile Card */}
				<Card className="mb-4 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center">
						<View className="h-14 w-14 items-center justify-center rounded-full bg-[#f95a24]/10">
							<Ionicons name="person" size={28} color="#f95a24" />
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

				{/* MODE SWITCHER CARD (ADMIN ⇄ WORKER) */}
				<Card className="mb-5 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="mb-2 flex-row items-center justify-between">
						<View className="flex-row items-center">
							<Ionicons name="swap-horizontal" size={20} color="#f95a24" />
							<Text className="ml-2 font-bold text-base text-slate-900 dark:text-white">
								App Mode Switcher
							</Text>
						</View>
						<View
							className={`rounded-full px-2.5 py-0.5 ${
								mode === "admin"
									? "bg-amber-100 dark:bg-amber-950/60"
									: "bg-teal-100 dark:bg-teal-950/60"
							}`}
						>
							<Text
								className={`font-bold text-xs uppercase ${
									mode === "admin"
										? "text-amber-700 dark:text-amber-400"
										: "text-teal-700 dark:text-teal-300"
								}`}
							>
								{mode === "admin" ? "Admin Mode" : "Worker Mode"}
							</Text>
						</View>
					</View>
					<Text className="mb-3 text-slate-500 text-xs dark:text-zinc-400">
						Switch between full Godown/Admin distribution overview and On-field
						Worker van mode.
					</Text>

					{/* Mode Selector Toggle */}
					<View className="flex-row rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
						<Pressable
							onPress={() => setMode("admin")}
							className={`flex-1 flex-row items-center justify-center rounded-lg py-2.5 ${
								mode === "admin"
									? "bg-white shadow-sm dark:bg-zinc-700"
									: "bg-transparent"
							}`}
						>
							<Ionicons
								name="shield-checkmark"
								size={16}
								color={mode === "admin" ? "#f95a24" : "#64748b"}
							/>
							<Text
								className={`ml-1.5 font-bold text-xs ${
									mode === "admin"
										? "text-[#f95a24]"
										: "text-slate-600 dark:text-zinc-400"
								}`}
							>
								Admin Mode
							</Text>
						</Pressable>

						<Pressable
							onPress={() => setMode("worker")}
							className={`flex-1 flex-row items-center justify-center rounded-lg py-2.5 ${
								mode === "worker"
									? "bg-white shadow-sm dark:bg-zinc-700"
									: "bg-transparent"
							}`}
						>
							<Ionicons
								name="bicycle"
								size={16}
								color={mode === "worker" ? "#0d9488" : "#64748b"}
							/>
							<Text
								className={`ml-1.5 font-bold text-xs ${
									mode === "worker"
										? "text-[#0d9488]"
										: "text-slate-600 dark:text-zinc-400"
								}`}
							>
								Worker Mode
							</Text>
						</Pressable>
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
							<Ionicons name="moon-outline" size={20} color="#64748b" />
							<Text className="ml-2.5 font-semibold text-slate-800 text-sm dark:text-zinc-200">
								Dark Theme
							</Text>
						</View>
						<ThemeToggle />
					</View>
				</Card>
			</ScrollView>
		</Container>
	);
}
