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
import { useSystemAdminTelemetry } from "@/hooks/queries/use-system-admin";

export default function SystemAdminTelemetryScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const insets = useSafeAreaInsets();
	const [refreshing, setRefreshing] = useState(false);

	const { data: telemetry, isLoading, refetch } = useSystemAdminTelemetry();

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	const memory = telemetry?.memory;
	const counts = telemetry?.collectionCounts;

	return (
		<Container
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
			isScrollable={false}
		>
			{/* Top Bar */}
			<View className="flex-row items-center justify-between border-slate-200 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
				<View className="flex-row items-center gap-2.5">
					<View className="size-8 items-center justify-center rounded-xl bg-emerald-500/15">
						<Ionicons name="hardware-chip" size={18} color="#10b981" />
					</View>
					<View>
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							Server & Database
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							Live telemetry, health & multi-tenant storage
						</Text>
					</View>
				</View>

				<View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/40">
					<View className="size-2 rounded-full bg-emerald-500" />
					<Text className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
						LIVE
					</Text>
				</View>
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
				{isLoading && !refreshing ? (
					<View className="items-center py-12">
						<ActivityIndicator size="large" color={themeAccent} />
						<Text className="mt-3 font-medium text-slate-400 text-xs">
							Fetching server telemetry...
						</Text>
					</View>
				) : (
					<>
						{/* Server Uptime & Node Banner */}
						<Card className="mb-4 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
								Node.js Runtime & Status
							</Text>

							<View className="mt-3 flex-row items-center justify-between">
								<View>
									<Text className="font-black text-2xl text-slate-900 tracking-tight dark:text-white">
										{telemetry?.uptime || "0h 0m 0s"}
									</Text>
									<Text className="font-medium text-[11px] text-slate-400">
										Active Process Uptime
									</Text>
								</View>

								<View className="items-end">
									<View className="rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-zinc-800">
										<Text className="font-bold font-mono text-slate-700 text-xs dark:text-zinc-300">
											Node {telemetry?.nodeVersion || "v20"}
										</Text>
									</View>
									<Text className="mt-1 font-semibold text-[10px] text-emerald-600 dark:text-emerald-400">
										DB: {telemetry?.database || "CONNECTED"}
									</Text>
								</View>
							</View>
						</Card>

						{/* Memory Consumption */}
						<Card className="mb-4 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
								Memory Consumption (V8 Heap)
							</Text>

							<View className="mt-3 gap-2">
								<View className="flex-row items-center justify-between">
									<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-400">
										Heap Used:
									</Text>
									<Text className="font-bold text-slate-900 text-sm dark:text-white">
										{memory?.heapUsedMB ?? 0} MB
									</Text>
								</View>

								<View className="flex-row items-center justify-between">
									<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-400">
										Heap Total:
									</Text>
									<Text className="font-bold text-slate-900 text-sm dark:text-white">
										{memory?.heapTotalMB ?? 0} MB
									</Text>
								</View>

								<View className="flex-row items-center justify-between">
									<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-400">
										Resident Set (RSS):
									</Text>
									<Text className="font-bold text-slate-900 text-sm dark:text-white">
										{memory?.rssMB ?? 0} MB
									</Text>
								</View>
							</View>
						</Card>

						{/* Multi-Tenant Database Collections */}
						<Text className="mb-3 font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
							MongoDB Multi-Tenant Collections
						</Text>

						<View className="mb-5 gap-2.5">
							<View className="flex-row gap-2.5">
								<Card className="flex-1 border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<Text className="font-medium text-[11px] text-slate-400">
										Total Users
									</Text>
									<Text className="mt-1 font-black text-slate-900 text-xl dark:text-white">
										{counts?.users ?? 0}
									</Text>
								</Card>

								<Card className="flex-1 border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<Text className="font-medium text-[11px] text-slate-400">
										Organizations
									</Text>
									<Text className="mt-1 font-black text-slate-900 text-xl dark:text-white">
										{counts?.organizations ?? 0}
									</Text>
								</Card>
							</View>

							<View className="flex-row gap-2.5">
								<Card className="flex-1 border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<Text className="font-medium text-[11px] text-slate-400">
										Catalog Products
									</Text>
									<Text className="mt-1 font-black text-slate-900 text-xl dark:text-white">
										{counts?.products ?? 0}
									</Text>
								</Card>

								<Card className="flex-1 border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<Text className="font-medium text-[11px] text-slate-400">
										Customer Accounts
									</Text>
									<Text className="mt-1 font-black text-slate-900 text-xl dark:text-white">
										{counts?.customers ?? 0}
									</Text>
								</Card>
							</View>

							<View className="flex-row gap-2.5">
								<Card className="flex-1 border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<Text className="font-medium text-[11px] text-slate-400">
										Sales Invoices
									</Text>
									<Text className="mt-1 font-black text-slate-900 text-xl dark:text-white">
										{counts?.sales ?? 0}
									</Text>
								</Card>

								<Card className="flex-1 border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<Text className="font-medium text-[11px] text-slate-400">
										Stock Ledger Logs
									</Text>
									<Text className="mt-1 font-black text-slate-900 text-xl dark:text-white">
										{counts?.stockTransactions ?? 0}
									</Text>
								</Card>
							</View>
						</View>

						{/* Return to Agency DMS App Button */}
						<Pressable
							onPress={() => router.replace("/(drawer)/(tabs)" as any)}
							className="flex-row items-center justify-center gap-2 rounded-2xl bg-accent py-4 active:opacity-90"
						>
							<Ionicons name="arrow-back" size={18} color="#ffffff" />
							<Text className="font-bold text-base text-white">
								Return to Agency DMS App
							</Text>
						</Pressable>
					</>
				)}
			</ScrollView>
		</Container>
	);
}
