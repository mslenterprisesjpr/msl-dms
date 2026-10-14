import { Ionicons } from "@expo/vector-icons";
import { Card, useThemeColor } from "heroui-native";
import React, { useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { useAdminStats, useWorkerStats } from "@/hooks/queries/use-dashboard";
import { useSession } from "@/lib/hooks/use-session";
export default function ReportsScreen() {
	const themeAccent = useThemeColor("accent");
	const { user } = useSession();
	const isAdmin = user?.role === "admin";
	const [refreshing, setRefreshing] = useState(false);

	const {
		data: adminStats,
		refetch: refetchAdminStats,
		isLoading: isAdminLoading,
	} = useAdminStats({ enabled: isAdmin });

	const {
		data: workerStats,
		refetch: refetchWorkerStats,
		isLoading: isWorkerLoading,
	} = useWorkerStats(user?.id, { enabled: !isAdmin });

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			if (isAdmin) {
				await refetchAdminStats();
			} else {
				await refetchWorkerStats();
			}
		} finally {
			setRefreshing(false);
		}
	};

	const stats = isAdmin ? adminStats : workerStats;
	const isLoading = isAdmin ? isAdminLoading : isWorkerLoading;

	const todaySales = stats?.todaySales ?? 0;
	const todayCollection = stats?.todayCollection ?? 0;
	const todayCash = stats?.todayCash ?? 0;
	const todayUpi = stats?.todayUpi ?? 0;
	const monthlyRevenue =
		stats?.monthlyRevenue ?? (stats as any)?.monthlySales ?? 0;
	const totalOutstanding = (stats as any)?.totalOutstanding ?? 0;

	return (
		<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={themeAccent}
					/>
				}
			>
				{isLoading ? (
					<View className="items-center py-20">
						<ActivityIndicator size="small" color={themeAccent} />
					</View>
				) : (
					<>
						{/* Daily Collection Split Card */}
						<Text className="mb-2.5 font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
							Today's Payment Collection
						</Text>
						<Card className="mb-4 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
								<Text className="font-semibold text-slate-700 text-sm dark:text-zinc-300">
									Total Collected Today
								</Text>
								<Text className="font-black text-emerald-600 text-xl dark:text-emerald-400">
									₹{todayCollection.toLocaleString("en-IN")}
								</Text>
							</View>

							{/* Cash vs UPI Breakdown */}
							<View className="mt-3 flex-row gap-3">
								<View className="flex-1 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
									<View className="mb-1 flex-row items-center justify-between">
										<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-400">
											Cash in Hand
										</Text>
										<Ionicons name="cash-outline" size={16} color="#10b981" />
									</View>
									<Text className="font-bold text-base text-slate-900 dark:text-white">
										₹{todayCash.toLocaleString("en-IN")}
									</Text>
								</View>

								<View className="flex-1 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
									<View className="mb-1 flex-row items-center justify-between">
										<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-400">
											UPI / Online
										</Text>
										<Ionicons name="flash-outline" size={16} color="#0d9488" />
									</View>
									<Text className="font-bold text-base text-slate-900 dark:text-white">
										₹{todayUpi.toLocaleString("en-IN")}
									</Text>
								</View>
							</View>
						</Card>

						{/* Sales & Outstanding Overview */}
						<Text className="mb-2.5 font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
							Sales Performance
						</Text>
						<View className="mb-4 gap-3">
							{/* Today Sales */}
							<Card className="border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center">
										<View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
											<Ionicons
												name="trending-up"
												size={20}
												color={themeAccent}
											/>
										</View>
										<View>
											<Text className="font-semibold text-slate-900 text-sm dark:text-white">
												Today's Gross Sales
											</Text>
											<Text className="text-slate-400 text-xs">
												Total bills booked today
											</Text>
										</View>
									</View>
									<Text className="font-black text-base text-slate-900 dark:text-white">
										₹{todaySales.toLocaleString("en-IN")}
									</Text>
								</View>
							</Card>

							{/* Month-to-Date Revenue */}
							<Card className="border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center">
										<View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#0d9488]/10">
											<Ionicons
												name="calendar-outline"
												size={20}
												color="#0d9488"
											/>
										</View>
										<View>
											<Text className="font-semibold text-slate-900 text-sm dark:text-white">
												Month's Revenue
											</Text>
											<Text className="text-slate-400 text-xs">
												Total current month billing
											</Text>
										</View>
									</View>
									<Text className="font-black text-[#0d9488] text-base">
										₹{monthlyRevenue.toLocaleString("en-IN")}
									</Text>
								</View>
							</Card>

							{/* Market Outstanding (Admin only) */}
							{isAdmin && (
								<Card className="border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<View className="flex-row items-center justify-between">
										<View className="flex-row items-center">
											<View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
												<Ionicons
													name="time-outline"
													size={20}
													color="#ef4444"
												/>
											</View>
											<View>
												<Text className="font-semibold text-slate-900 text-sm dark:text-white">
													Market Outstanding
												</Text>
												<Text className="text-slate-400 text-xs">
													Total unpaid credit in market
												</Text>
											</View>
										</View>
										<Text className="font-black text-base text-red-500">
											₹{totalOutstanding.toLocaleString("en-IN")}
										</Text>
									</View>
								</Card>
							)}
						</View>
					</>
				)}
			</ScrollView>
		</Container>
	);
}
