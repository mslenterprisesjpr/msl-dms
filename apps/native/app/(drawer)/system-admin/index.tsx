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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { useSystemAdminStats } from "@/hooks/queries/use-system-admin";
import { useOrganizations } from "@/lib/hooks/use-organizations";
import { useSession } from "@/lib/hooks/use-session";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function SystemAdminOverviewScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const insets = useSafeAreaInsets();
	const { user } = useSession();
	const { organizations, currentOrgId } = useOrganizations();
	const { setCurrentOrg } = useOrganizationStore();

	const [refreshing, setRefreshing] = useState(false);
	const {
		data: stats,
		isLoading,
		refetch: refetchStats,
	} = useSystemAdminStats(user?.role === "admin");

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
	const totalUsers = stats?.totalUsers ?? 0;
	const totalRevenue = stats?.totalRevenue ?? 0;
	const totalBills = stats?.totalBills ?? 0;

	return (
		<Container
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
			isScrollable={false}
		>
			{/* Top Header Bar with Exit to Agency Button */}
			<View className="flex-row items-center justify-between border-slate-200 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
				<View className="flex-row items-center gap-2.5">
					<View className="size-8 items-center justify-center rounded-xl bg-accent/15">
						<Ionicons name="shield-checkmark" size={18} color={themeAccent} />
					</View>
					<View>
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							Super Admin Console
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							Platform Multi-Tenant Control
						</Text>
					</View>
				</View>

				<Pressable
					onPress={() => router.replace("/(drawer)/(tabs)" as any)}
					className="flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 active:opacity-75 dark:border-zinc-700 dark:bg-zinc-800"
				>
					<Ionicons name="arrow-back" size={14} color={themeColorForeground} />
					<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
						Agency DMS
					</Text>
				</Pressable>
			</View>

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
									SYSTEM SUPER ADMIN
								</Text>
							</View>
							<Text className="font-bold text-accent-foreground text-xl">
								MSL Global Network
							</Text>
							<Text className="mt-1 text-accent-foreground/80 text-xs">
								Global multi-tenant control, agency management & platform
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
									{stats?.systemStatus || "OPTIMAL"}
								</Text>
							</Text>
						</View>
						<View className="rounded-full bg-white/15 px-2.5 py-0.5">
							<Text className="font-bold text-[10px] text-white">
								Active: {activeOrgs}/{totalOrgs} Orgs
							</Text>
						</View>
					</View>
				</Card>

				{/* 2x2 High-Level SaaS Metrics */}
				<Text className="mb-3 font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
					Global Platform Metrics
				</Text>
				<View className="mb-5 gap-3">
					<View className="flex-row gap-3">
						{/* Total Revenue */}
						<Card className="flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center justify-between">
								<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
									Platform Gross
								</Text>
								<View className="size-7 items-center justify-center rounded-lg bg-emerald-500/10">
									<Ionicons name="cash-outline" size={16} color="#10b981" />
								</View>
							</View>
							<Text className="mt-2 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
								₹{totalRevenue.toLocaleString("en-IN")}
							</Text>
							<Text className="mt-1 font-medium text-[11px] text-slate-400">
								Across all agencies
							</Text>
						</Card>

						{/* Total Invoices */}
						<Card className="flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center justify-between">
								<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
									Total Bills
								</Text>
								<View className="size-7 items-center justify-center rounded-lg bg-sky-500/10">
									<Ionicons name="receipt-outline" size={16} color="#0284c7" />
								</View>
							</View>
							<Text className="mt-2 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
								{totalBills.toLocaleString("en-IN")}
							</Text>
							<Text className="mt-1 font-medium text-[11px] text-slate-400">
								Invoices generated
							</Text>
						</Card>
					</View>

					<View className="flex-row gap-3">
						{/* Total Organizations */}
						<Card className="flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center justify-between">
								<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
									Tenants / Orgs
								</Text>
								<View className="size-7 items-center justify-center rounded-lg bg-indigo-500/10">
									<Ionicons name="business-outline" size={16} color="#6366f1" />
								</View>
							</View>
							<Text className="mt-2 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
								{totalOrgs}
							</Text>
							<Text className="mt-1 font-medium text-[11px] text-emerald-600 dark:text-emerald-400">
								{activeOrgs} active agencies
							</Text>
						</Card>

						{/* Total Users */}
						<Card className="flex-1 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center justify-between">
								<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
									Global Users
								</Text>
								<View className="size-7 items-center justify-center rounded-lg bg-purple-500/10">
									<Ionicons name="people-outline" size={16} color="#a855f7" />
								</View>
							</View>
							<Text className="mt-2 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
								{totalUsers}
							</Text>
							<Text className="mt-1 font-medium text-[11px] text-slate-400">
								Staff & Admins
							</Text>
						</Card>
					</View>
				</View>

				{/* Quick Section Shortcuts */}
				<Text className="mb-3 font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
					Control Center Modules
				</Text>
				<View className="mb-5 gap-3">
					<Pressable
						onPress={() =>
							router.push("/(drawer)/system-admin/organizations" as any)
						}
					>
						<Card className="border border-slate-100 bg-white p-4 shadow-sm active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center">
								<View className="mr-3.5 size-11 items-center justify-center rounded-xl bg-blue-500/10">
									<Ionicons name="business" size={22} color="#3b82f6" />
								</View>
								<View className="flex-1">
									<Text className="font-bold text-base text-slate-900 dark:text-white">
										Manage Agencies
									</Text>
									<Text className="text-slate-500 text-xs dark:text-zinc-400">
										View all tenant agencies, switch context & inspect members
									</Text>
								</View>
								<Ionicons name="chevron-forward" size={18} color="#94a3b8" />
							</View>
						</Card>
					</Pressable>

					<Pressable
						onPress={() => router.push("/(drawer)/system-admin/users" as any)}
					>
						<Card className="border border-slate-100 bg-white p-4 shadow-sm active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center">
								<View className="mr-3.5 size-11 items-center justify-center rounded-xl bg-purple-500/10">
									<Ionicons name="people" size={22} color="#a855f7" />
								</View>
								<View className="flex-1">
									<Text className="font-bold text-base text-slate-900 dark:text-white">
										Global User Directory
									</Text>
									<Text className="text-slate-500 text-xs dark:text-zinc-400">
										Platform users, role management & agency assignments
									</Text>
								</View>
								<Ionicons name="chevron-forward" size={18} color="#94a3b8" />
							</View>
						</Card>
					</Pressable>

					<Pressable
						onPress={() =>
							router.push("/(drawer)/system-admin/telemetry" as any)
						}
					>
						<Card className="border border-slate-100 bg-white p-4 shadow-sm active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center">
								<View className="mr-3.5 size-11 items-center justify-center rounded-xl bg-emerald-500/10">
									<Ionicons name="hardware-chip" size={22} color="#10b981" />
								</View>
								<View className="flex-1">
									<Text className="font-bold text-base text-slate-900 dark:text-white">
										Server & Database Telemetry
									</Text>
									<Text className="text-slate-500 text-xs dark:text-zinc-400">
										MongoDB connection, heap memory & live server stats
									</Text>
								</View>
								<Ionicons name="chevron-forward" size={18} color="#94a3b8" />
							</View>
						</Card>
					</Pressable>
				</View>

				{/* Return to Agency App Action */}
				<Pressable
					onPress={() => router.replace("/(drawer)/(tabs)" as any)}
					className="flex-row items-center justify-center gap-2 rounded-2xl bg-accent py-4 active:opacity-90"
				>
					<Ionicons name="arrow-back" size={18} color="#ffffff" />
					<Text className="font-bold text-base text-white">
						Return to Agency DMS App
					</Text>
				</Pressable>
			</ScrollView>
		</Container>
	);
}
