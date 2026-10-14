import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { useSystemStats } from "@/hooks/queries/use-system-stats";
import { useOrganizations } from "@/lib/hooks/use-organizations";
import { useSession } from "@/lib/hooks/use-session";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function SystemAdminOverviewScreen() {
	const themeAccent = useThemeColor("accent");
	const themeForeground = useThemeColor("foreground");
	const { user } = useSession();
	const { organizations, currentOrgId } = useOrganizations();
	const { setCurrentOrg } = useOrganizationStore();

	const [refreshing, setRefreshing] = useState(false);
	const {
		data: stats,
		isLoading,
		refetch: refetchStats,
	} = useSystemStats({ enabled: user?.role === "admin" });

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetchStats();
		} finally {
			setRefreshing(false);
		}
	};

	const totalOrgs = stats?.totalOrganizations ?? organizations.length;
	const activeOrgs = stats?.activeOrganizations ?? organizations.length;
	const totalUsers = stats?.totalUsers ?? "--";
	const totalRevenue = stats?.totalRevenue ?? 0;
	const totalBills = stats?.totalBills ?? 0;

	return (
		<Container
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
			isScrollable={false}
		>
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={[themeAccent]}
						tintColor={themeAccent}
					/>
				}
			>
				{/* Platform Admin Banner */}
				<Card className="mb-5 overflow-hidden border border-accent/20 bg-accent p-5 shadow-sm">
					<View className="flex-row items-center justify-between">
						<View className="flex-1 pr-3">
							<View className="mb-1.5 flex-row items-center">
								<View className="mr-2 size-2 rounded-full bg-emerald-400" />
								<Text className="font-bold text-[11px] text-accent-foreground/80 uppercase tracking-wider">
									SYSTEM SUPER ADMIN CONSOLE
								</Text>
							</View>
							<Text className="font-bold text-accent-foreground text-xl">
								MSL Platform Overview
							</Text>
							<Text className="mt-1 text-accent-foreground/80 text-xs">
								Global multi-tenant control, agency management & system
								telemetry
							</Text>
						</View>
						<View className="size-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
							<Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
						</View>
					</View>

					<View className="mt-4 flex-row items-center justify-between border-white/10 border-t pt-3">
						<View className="flex-row items-center">
							<Ionicons name="server-outline" size={14} color="#FFFFFF" />
							<Text className="ml-1.5 font-medium text-white/90 text-xs">
								System Health:{" "}
								<Text className="font-bold text-emerald-300">
									Optimal (99.9%)
								</Text>
							</Text>
						</View>
						<View className="rounded-full bg-white/15 px-2.5 py-0.5">
							<Text className="font-bold text-[10px] text-white uppercase">
								Role: {user?.role || "Admin"}
							</Text>
						</View>
					</View>
				</Card>

				{/* Global KPI Metrics (Real Data) */}
				<Text className="mb-3 font-bold text-base text-slate-900 dark:text-white">
					Platform Telemetry
				</Text>

				<View className="mb-6 flex-row flex-wrap gap-3">
					{/* Total Agencies */}
					<Card className="min-w-[46%] flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
								Registered Agencies
							</Text>
							<View className="size-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
								<Ionicons name="business-outline" size={18} color="#3b82f6" />
							</View>
						</View>
						<Text className="mt-2 font-bold text-2xl text-slate-900 dark:text-white">
							{isLoading ? "--" : totalOrgs}
						</Text>
						<Text className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
							{activeOrgs} active tenant{activeOrgs === 1 ? "" : "s"}
						</Text>
					</Card>

					{/* Total Platform Users */}
					<Card className="min-w-[46%] flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
								Platform Users
							</Text>
							<View className="size-8 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/40">
								<Ionicons name="people-outline" size={18} color="#8b5cf6" />
							</View>
						</View>
						<Text className="mt-2 font-bold text-2xl text-slate-900 dark:text-white">
							{isLoading ? "--" : totalUsers}
						</Text>
						<Text className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
							Admins & workers
						</Text>
					</Card>

					{/* Platform Revenue */}
					<Card className="min-w-[46%] flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
								Gross Platform Sales
							</Text>
							<View className="size-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
								<Ionicons name="cash-outline" size={18} color="#10b981" />
							</View>
						</View>
						<Text className="mt-2 font-bold text-2xl text-slate-900 dark:text-white">
							₹{totalRevenue.toLocaleString("en-IN")}
						</Text>
						<Text className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
							{totalBills} total invoices
						</Text>
					</Card>

					{/* Active Services */}
					<Card className="min-w-[46%] flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
								SaaS State
							</Text>
							<View className="size-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
								<Ionicons name="pulse-outline" size={18} color="#f59e0b" />
							</View>
						</View>
						<Text className="mt-2 font-bold text-emerald-600 text-lg dark:text-emerald-400">
							ACTIVE
						</Text>
						<Text className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
							MongoDB + Better Auth
						</Text>
					</Card>
				</View>

				{/* Quick Management Actions */}
				<Text className="mb-3 font-bold text-base text-slate-900 dark:text-white">
					System Administration Hub
				</Text>

				{/* Manage Organizations / Agencies */}
				<Card className="mb-3 overflow-hidden border border-slate-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Pressable
						onPress={() => router.push("/(drawer)/(tabs)/organizations")}
						className="flex-row items-center p-4"
					>
						<View className="size-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
							<Ionicons name="business" size={22} color="#3b82f6" />
						</View>
						<View className="ml-3.5 flex-1">
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								Agency & Organization Manager
							</Text>
							<Text className="mt-0.5 text-slate-500 text-xs dark:text-zinc-400">
								Create new agencies, invite distributors, assign org roles
							</Text>
						</View>
						<Ionicons name="chevron-forward" size={20} color="#94a3b8" />
					</Pressable>
				</Card>

				{/* User Management */}
				<Card className="mb-3 overflow-hidden border border-slate-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Pressable
						onPress={() => router.push("/settings/users")}
						className="flex-row items-center p-4"
					>
						<View className="size-11 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50">
							<Ionicons name="people" size={22} color="#8b5cf6" />
						</View>
						<View className="ml-3.5 flex-1">
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								Global User Directory
							</Text>
							<Text className="mt-0.5 text-slate-500 text-xs dark:text-zinc-400">
								Ban/unban accounts, reset passwords, promote to System Admin
							</Text>
						</View>
						<Ionicons name="chevron-forward" size={20} color="#94a3b8" />
					</Pressable>
				</Card>

				{/* Quick Impersonate / Switch Agency */}
				<Card className="mb-6 overflow-hidden border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="mb-3 flex-row items-center justify-between">
						<View className="flex-row items-center">
							<Ionicons name="swap-horizontal" size={18} color={themeAccent} />
							<Text className="ml-2 font-bold text-slate-900 text-sm dark:text-white">
								Quick Agency Switcher (Impersonate View)
							</Text>
						</View>
						<Text className="text-[11px] text-slate-400">
							{organizations.length} available
						</Text>
					</View>

					<Text className="mb-3 text-slate-500 text-xs dark:text-zinc-400">
						Select any registered distributor to view their daily stock, billing
						and workers:
					</Text>

					<View className="gap-2">
						{organizations.slice(0, 4).map((org) => {
							const isCurrent = currentOrgId === org.id;
							return (
								<Pressable
									key={org.id}
									onPress={() => {
										setCurrentOrg(org.id);
										router.push("/(drawer)/(tabs)");
									}}
									className={`flex-row items-center justify-between rounded-xl border p-3 ${
										isCurrent
											? "border-accent bg-accent/5 dark:bg-accent/15"
											: "border-slate-100 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50"
									}`}
								>
									<View className="flex-1 pr-2">
										<Text
											className={`font-semibold text-sm ${
												isCurrent
													? "text-accent"
													: "text-slate-800 dark:text-zinc-200"
											}`}
										>
											{org.name}
										</Text>
										<Text className="text-[11px] text-slate-400 dark:text-zinc-500">
											@{org.slug}
										</Text>
									</View>
									{isCurrent ? (
										<View className="flex-row items-center rounded-full bg-accent/15 px-2 py-0.5">
											<Ionicons
												name="checkmark-circle"
												size={14}
												color={themeAccent}
											/>
											<Text className="ml-1 font-bold text-[10px] text-accent">
												ACTIVE VIEW
											</Text>
										</View>
									) : (
										<Text className="font-medium text-slate-400 text-xs">
											Switch &rarr;
										</Text>
									)}
								</Pressable>
							);
						})}
					</View>
				</Card>

				{/* Return to App Button */}
				<Pressable
					onPress={() => router.push("/(drawer)/(tabs)")}
					className="h-12 flex-row items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				>
					<Ionicons name="arrow-back" size={18} color={themeForeground} />
					<Text className="ml-2 font-semibold text-slate-800 text-sm dark:text-zinc-200">
						Return to Distributor Operations (Tabs)
					</Text>
				</Pressable>
			</ScrollView>
		</Container>
	);
}
