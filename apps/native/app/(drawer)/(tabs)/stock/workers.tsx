import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	RefreshControl,
	ScrollView,
	Switch,
	Text,
	TextInput,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { HeroBottomSheet } from "@/components/hero-bottom-sheet";
import {
	useAllWorkersStock,
	useCloseDay,
	type WorkerVanSummary,
} from "@/hooks/queries/use-worker-stock";

export default function WorkersLiveStockScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const { toast } = useToast();

	const [search, setSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);

	// Settlement Modal State
	const [settleModalVisible, setSettleModalVisible] = useState(false);
	const [selectedWorker, setSelectedWorker] = useState<WorkerVanSummary | null>(
		null,
	);
	const [cashReceivedInput, setCashReceivedInput] = useState("");
	const [returnStockToWarehouse, setReturnStockToWarehouse] = useState(false);
	const [settleNote, setSettleNote] = useState("");

	// Queries & Mutations
	const { data: allWorkersResponse, isLoading, refetch } = useAllWorkersStock();
	const closeDayMutation = useCloseDay();

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	const apiSummary = allWorkersResponse?.summary;
	const workers = allWorkersResponse?.data || [];

	// Derived summary from workers array as single source of truth
	// This prevents summary=0 when data=workers (race/inconsistency issue)
	const summary = {
		totalWorkers: workers.length || (apiSummary?.totalWorkers ?? 0),
		totalUnitsInVans:
			workers.reduce((sum, w) => sum + (w.totalUnits ?? 0), 0) ||
			(apiSummary?.totalUnitsInVans ?? 0),
		totalCasesInVans:
			workers.reduce((sum, w) => sum + (w.totalCases ?? 0), 0) ||
			(apiSummary?.totalCasesInVans ?? 0),
		totalStockValue:
			workers.reduce((sum, w) => sum + (w.stockValue ?? 0), 0) ||
			(apiSummary?.totalStockValue ?? 0),
		totalTodaySales:
			workers.reduce((sum, w) => sum + (w.todayStats?.totalSales ?? 0), 0) ||
			(apiSummary?.totalTodaySales ?? 0),
		totalCashToCollect:
			workers.reduce((sum, w) => sum + (w.todayStats?.cashCollected ?? 0), 0) ||
			(apiSummary?.totalCashToCollect ?? 0),
		totalUpiCollected:
			workers.reduce((sum, w) => sum + (w.todayStats?.upiCollected ?? 0), 0) ||
			(apiSummary?.totalUpiCollected ?? 0),
	};

	const filteredWorkers = useMemo(() => {
		if (!search.trim()) return workers;
		const q = search.toLowerCase();
		return workers.filter(
			(w) =>
				(w.workerName || "").toLowerCase().includes(q) ||
				w.workerEmail?.toLowerCase().includes(q) ||
				w.workerId.toLowerCase().includes(q),
		);
	}, [workers, search]);

	// Open Settlement Modal
	const handleOpenSettlement = (worker: WorkerVanSummary) => {
		setSelectedWorker(worker);
		const cashCollected = worker?.todayStats?.cashCollected ?? 0;
		setCashReceivedInput(cashCollected.toString());
		setReturnStockToWarehouse((worker?.totalUnits ?? 0) > 0);
		setSettleNote("");
		setSettleModalVisible(true);
	};

	// Confirm Settlement
	const handleConfirmSettlement = async () => {
		if (!selectedWorker) return;

		const cashAmount = Number.parseFloat(cashReceivedInput) || 0;

		try {
			await closeDayMutation.mutateAsync({
				workerId: selectedWorker.workerId,
				cashReceived: cashAmount,
				returnAllStockToWarehouse: returnStockToWarehouse,
				note: settleNote.trim() || undefined,
			});

			toast.show({
				variant: "success",
				label: `Day settled for ${selectedWorker.workerName}!`,
			});

			setSettleModalVisible(false);
			setSelectedWorker(null);
			await refetch();
		} catch (error: any) {
			console.error("Settlement error:", error);
			Alert.alert(
				"Settlement Failed",
				error?.message || "Failed to complete day-end settlement",
			);
		}
	};

	return (
		<Container
			isScrollable={false}
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
		>
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={[themeAccent || "#0284c7", "#10b981"]}
						tintColor={themeAccent || "#0284c7"}
						progressBackgroundColor="#ffffff"
					/>
				}
			>
				{/* 1. TOP EXECUTIVE FLEET KPI SUMMARY */}
				<View className="mb-4">
					<View className="mb-2 flex-row items-center justify-between">
						<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
							Van Fleet & Day-End Overview
						</Text>
						<Pressable
							onPress={onRefresh}
							disabled={refreshing}
							className="flex-row items-center gap-1 rounded-lg bg-slate-200/60 px-2 py-1 active:opacity-70 dark:bg-zinc-800"
							hitSlop={8}
						>
							<Ionicons
								name="refresh"
								size={12}
								color={themeAccent || "#0284c7"}
							/>
							<Text className="font-semibold text-[11px] text-slate-600 dark:text-zinc-300">
								{refreshing ? "Syncing..." : "Sync Live"}
							</Text>
						</Pressable>
					</View>

					{/* Row 1: Active Vans & Total Van Stock Value */}
					<View className="mb-3 flex-row gap-3">
						{/* Active Vans */}
						<View className="flex-1 rounded-2xl border border-sky-100 bg-[#f0f9ff] p-3.5 shadow-sm dark:border-sky-950/60 dark:bg-sky-950/20">
							<View className="flex-row items-center justify-between">
								<View className="flex-row items-center">
									<View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15">
										<Ionicons name="car-outline" size={16} color="#0284c7" />
									</View>
									<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
										Active Vans
									</Text>
								</View>
							</View>
							<Text className="my-1 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
								{summary?.totalWorkers ?? 0}
							</Text>
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								workers in field
							</Text>
						</View>

						{/* Total Stock in Vans */}
						<View className="flex-1 rounded-2xl border border-emerald-100 bg-[#f0fdf4] p-3.5 shadow-sm dark:border-emerald-950/60 dark:bg-emerald-950/20">
							<View className="flex-row items-center justify-between">
								<View className="flex-row items-center">
									<View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
										<Ionicons name="cube-outline" size={16} color="#10b981" />
									</View>
									<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
										Van Stock
									</Text>
								</View>
							</View>
							<Text className="my-1 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
								₹{(summary?.totalStockValue ?? 0).toLocaleString("en-IN")}
							</Text>
							<Text className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">
								{(summary?.totalUnitsInVans ?? 0).toLocaleString("en-IN")} units
								({summary?.totalCasesInVans ?? 0} cases)
							</Text>
						</View>
					</View>

					{/* Row 2: Cash to Collect & Today Van Sales */}
					<View className="flex-row gap-3">
						{/* Cash to Collect */}
						<View className="flex-1 rounded-2xl border border-amber-100 bg-[#fffbeb] p-3.5 shadow-sm dark:border-amber-950/60 dark:bg-amber-950/20">
							<View className="flex-row items-center justify-between">
								<View className="flex-row items-center">
									<View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
										<Ionicons name="cash-outline" size={16} color="#d97706" />
									</View>
									<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
										Cash in Hand
									</Text>
								</View>
							</View>
							<Text className="my-1 font-black text-2xl text-amber-700 tracking-tight dark:text-amber-400">
								₹{(summary?.totalCashToCollect ?? 0).toLocaleString("en-IN")}
							</Text>
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								to receive from workers
							</Text>
						</View>

						{/* Today Sales */}
						<View className="flex-1 rounded-2xl border border-indigo-100 bg-[#eef2ff] p-3.5 shadow-sm dark:border-indigo-950/60 dark:bg-indigo-950/20">
							<View className="flex-row items-center justify-between">
								<View className="flex-row items-center">
									<View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15">
										<Ionicons
											name="receipt-outline"
											size={16}
											color="#4f46e5"
										/>
									</View>
									<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
										Today's Sales
									</Text>
								</View>
							</View>
							<Text className="my-1 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
								₹{(summary?.totalTodaySales ?? 0).toLocaleString("en-IN")}
							</Text>
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								UPI: ₹
								{(summary?.totalUpiCollected ?? 0).toLocaleString("en-IN")}
							</Text>
						</View>
					</View>
				</View>

				{/* 2. SEARCH & WORKER FILTER */}
				<View className="mb-4 flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Ionicons
						name="search"
						size={18}
						color="#94a3b8"
						style={{ marginRight: 8 }}
					/>
					<TextInput
						placeholder="Search worker by name or email..."
						placeholderTextColor="#94a3b8"
						value={search}
						onChangeText={setSearch}
						className="flex-1 font-medium text-slate-900 text-sm dark:text-white"
					/>
					{search.length > 0 && (
						<Pressable onPress={() => setSearch("")}>
							<Ionicons name="close-circle" size={16} color="#94a3b8" />
						</Pressable>
					)}
				</View>

				{/* 3. WORKER VANS LIST */}
				<View className="gap-3">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							Workers & Vans ({filteredWorkers.length})
						</Text>
						<Pressable
							onPress={() => router.push("/stock/issue" as any)}
							className="flex-row items-center rounded-lg bg-accent/10 px-2.5 py-1"
						>
							<Ionicons name="add" size={14} color={themeAccent} />
							<Text className="ml-1 font-bold text-accent text-xs">
								Issue Stock
							</Text>
						</Pressable>
					</View>

					{isLoading ? (
						<View className="items-center py-16">
							<ActivityIndicator size="small" color={themeAccent} />
						</View>
					) : filteredWorkers.length === 0 ? (
						<Card className="items-center border border-slate-100 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
							<Ionicons name="car-outline" size={40} color="#94a3b8" />
							<Text className="mt-3 font-bold text-base text-slate-800 dark:text-zinc-200">
								No Workers Found
							</Text>
							<Text className="mt-1 text-center font-medium text-slate-400 text-xs dark:text-zinc-500">
								No workers currently have van stock assigned or today's
								activity.
							</Text>
							<Pressable
								onPress={() => router.push("/stock/issue" as any)}
								className="mt-4 rounded-xl bg-accent px-4 py-2"
							>
								<Text className="font-bold text-white text-xs">
									Issue Stock to Worker
								</Text>
							</Pressable>
						</Card>
					) : (
						filteredWorkers.map((worker) => {
							const stats = worker?.todayStats ?? {
								billsCount: 0,
								totalSales: 0,
								cashCollected: 0,
								upiCollected: 0,
								totalCollected: 0,
								pendingCredit: 0,
							};
							return (
								<Card
									key={worker.workerId}
									className="border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
								>
									{/* Worker Header Info */}
									<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
										<View className="flex-row items-center">
											<View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-accent/15">
												<Text className="font-black text-accent text-base">
													{(worker.workerName || "W")
														.trim()
														.charAt(0)
														.toUpperCase()}
												</Text>
											</View>
											<View>
												<Text className="font-bold text-base text-slate-900 dark:text-white">
													{worker.workerName}
												</Text>
												<Text className="font-medium text-slate-400 text-xs dark:text-zinc-500">
													{worker.workerEmail ||
														`ID: ${worker.workerId.slice(-6)}`}
												</Text>
											</View>
										</View>

										{/* Status Badge */}
										<View className="rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/40">
											<Text className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400">
												{worker.totalUnits > 0 ? "In Field" : "No Stock"}
											</Text>
										</View>
									</View>

									{/* Today's Financial Summary Row */}
									<View className="my-3 flex-row items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/50">
										<View className="items-center">
											<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
												Bills
											</Text>
											<Text className="font-bold text-slate-800 text-xs dark:text-white">
												{stats?.billsCount ?? 0}
											</Text>
										</View>

										<View className="h-6 w-px bg-slate-200 dark:bg-zinc-700" />

										<View className="items-center">
											<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
												Today's Sales
											</Text>
											<Text className="font-bold text-slate-800 text-xs dark:text-white">
												₹{(stats?.totalSales ?? 0).toLocaleString("en-IN")}
											</Text>
										</View>

										<View className="h-6 w-px bg-slate-200 dark:bg-zinc-700" />

										<View className="items-center">
											<Text className="font-medium text-[10px] text-emerald-600 dark:text-emerald-400">
												Cash in Hand
											</Text>
											<Text className="font-bold text-emerald-600 text-xs dark:text-emerald-400">
												₹{(stats?.cashCollected ?? 0).toLocaleString("en-IN")}
											</Text>
										</View>

										<View className="h-6 w-px bg-slate-200 dark:bg-zinc-700" />

										<View className="items-center">
											<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
												UPI
											</Text>
											<Text className="font-bold text-slate-800 text-xs dark:text-white">
												₹{(stats?.upiCollected ?? 0).toLocaleString("en-IN")}
											</Text>
										</View>
									</View>

									{/* Van Stock Breakdown */}
									<View className="mb-3">
										<View className="mb-2 flex-row items-center justify-between">
											<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
												Current Van Inventory
											</Text>
											<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
												{worker?.totalUnits ?? 0} Units (₹
												{(worker?.stockValue ?? 0).toLocaleString("en-IN")})
											</Text>
										</View>

										{!worker?.products || worker.products.length === 0 ? (
											<View className="rounded-xl border border-slate-200 border-dashed py-3 text-center dark:border-zinc-800">
												<Text className="text-center font-medium text-slate-400 text-xs dark:text-zinc-500">
													Van is currently empty
												</Text>
											</View>
										) : (
											<View className="gap-1.5">
												{(worker?.products || []).map((p) => (
													<View
														key={p?.productId || Math.random().toString()}
														className="flex-row items-center justify-between rounded-lg bg-slate-50/80 px-2.5 py-1.5 dark:bg-zinc-800/30"
													>
														<View className="flex-1 pr-2">
															<Text
																numberOfLines={1}
																className="font-medium text-slate-800 text-xs dark:text-zinc-200"
															>
																{p?.productName || "Product"}{" "}
																{p?.packSize ? `(${p.packSize})` : ""}
															</Text>
														</View>
														<View className="flex-row items-center gap-2">
															<Text className="font-bold text-slate-900 text-xs dark:text-white">
																{(p?.stockInCases ?? 0) > 0
																	? `${p.stockInCases} cs`
																	: ""}{" "}
																{(p?.remainingUnits ?? 0) > 0
																	? `+ ${p.remainingUnits} ${p?.unit || "pcs"}`
																	: (p?.stockInCases ?? 0) === 0
																		? `${p?.quantity ?? 0} ${p?.unit || "pcs"}`
																		: ""}
															</Text>
															<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
																₹{(p?.itemValue ?? 0).toLocaleString("en-IN")}
															</Text>
														</View>
													</View>
												))}
											</View>
										)}
									</View>

									{/* Action Buttons Row */}
									<View className="flex-row items-center gap-2 pt-1">
										{/* Day-End Settlement Button (Primary Action) */}
										<Pressable
											onPress={() => handleOpenSettlement(worker)}
											className="flex-1 flex-row items-center justify-center rounded-xl bg-accent py-2.5 shadow-sm active:opacity-90"
										>
											<Ionicons
												name="checkmark-circle-outline"
												size={16}
												color="#ffffff"
												style={{ marginRight: 4 }}
											/>
											<Text className="font-bold text-white text-xs">
												Close Day / Settle
											</Text>
										</Pressable>

										{/* Issue More Stock */}
										<Pressable
											onPress={() =>
												router.push({
													pathname: "/stock/issue" as any,
													params: { workerId: worker.workerId },
												})
											}
											className="flex-row items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900"
										>
											<Ionicons
												name="add"
												size={16}
												color={themeColorForeground}
											/>
											<Text className="ml-1 font-semibold text-slate-700 text-xs dark:text-zinc-300">
												Issue
											</Text>
										</Pressable>

										{/* Return Stock */}
										{(worker?.totalUnits ?? 0) > 0 && (
											<Pressable
												onPress={() =>
													router.push({
														pathname: "/stock/return" as any,
														params: { workerId: worker.workerId },
													})
												}
												className="flex-row items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900"
											>
												<Ionicons
													name="return-down-back"
													size={16}
													color={themeColorForeground}
												/>
												<Text className="ml-1 font-semibold text-slate-700 text-xs dark:text-zinc-300">
													Return
												</Text>
											</Pressable>
										)}
									</View>
								</Card>
							);
						})
					)}
				</View>
			</ScrollView>

			{/* 4. HEROUI NATIVE BOTTOM SHEET: DAY-END CLOSING & SETTLEMENT */}
			<HeroBottomSheet
				visible={settleModalVisible}
				onClose={() => setSettleModalVisible(false)}
				title="Day-End Settlement"
				subtitle={`Worker: ${selectedWorker?.workerName || "Worker"}`}
				snapPoints={["70%", "90%"]}
				footer={
					<View className="flex-row items-center gap-3">
						<Pressable
							onPress={() => setSettleModalVisible(false)}
							className="flex-1 items-center justify-center rounded-2xl border border-slate-200 py-3 active:opacity-80 dark:border-zinc-800"
						>
							<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
								Cancel
							</Text>
						</Pressable>

						<Pressable
							onPress={handleConfirmSettlement}
							disabled={closeDayMutation.isPending}
							className="flex-1 items-center justify-center rounded-2xl bg-accent py-3 shadow-sm active:opacity-90"
						>
							{closeDayMutation.isPending ? (
								<ActivityIndicator size="small" color="#ffffff" />
							) : (
								<Text className="font-bold text-white text-xs">
									Confirm & Close Day
								</Text>
							)}
						</Pressable>
					</View>
				}
			>
				<ScrollView className="py-1" showsVerticalScrollIndicator={false}>
					{/* Summary Metric Strip */}
					<View className="mb-4 rounded-2xl bg-amber-50 p-3.5 dark:bg-amber-950/20">
						<View className="flex-row items-center justify-between">
							<Text className="font-semibold text-amber-800 text-xs dark:text-amber-300">
								Today's Cash To Handover
							</Text>
							<Text className="font-black text-amber-700 text-lg dark:text-amber-400">
								₹
								{(
									selectedWorker?.todayStats?.cashCollected ?? 0
								).toLocaleString("en-IN")}
							</Text>
						</View>
						<Text className="mt-1 font-medium text-[11px] text-amber-700/80 dark:text-amber-300/70">
							Total Sales: ₹
							{(selectedWorker?.todayStats?.totalSales ?? 0).toLocaleString(
								"en-IN",
							)}{" "}
							• UPI: ₹
							{(selectedWorker?.todayStats?.upiCollected ?? 0).toLocaleString(
								"en-IN",
							)}
						</Text>
					</View>

					{/* Cash Received Input Field */}
					<View className="mb-4">
						<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
							Actual Cash Received from Worker (₹)
						</Text>
						<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800">
							<Text className="mr-1 font-bold text-base text-slate-500">₹</Text>
							<TextInput
								keyboardType="numeric"
								value={cashReceivedInput}
								onChangeText={setCashReceivedInput}
								placeholder="0"
								placeholderTextColor="#94a3b8"
								className="flex-1 font-bold text-base text-slate-900 dark:text-white"
							/>
						</View>
					</View>

					{/* Return Remaining Stock Toggle */}
					<View className="mb-4 rounded-2xl border border-slate-200 p-3.5 dark:border-zinc-800">
						<View className="flex-row items-center justify-between">
							<View className="flex-1 pr-3">
								<Text className="font-bold text-slate-800 text-xs dark:text-white">
									Return Remaining Stock to Warehouse
								</Text>
								<Text className="mt-0.5 font-medium text-[11px] text-slate-400 dark:text-zinc-500">
									{selectedWorker && selectedWorker.totalUnits > 0
										? `Clear van (${selectedWorker.totalUnits} units) back into warehouse stock`
										: "Van is already empty"}
								</Text>
							</View>
							<Switch
								value={returnStockToWarehouse}
								onValueChange={setReturnStockToWarehouse}
								trackColor={{ false: "#cbd5e1", true: themeAccent }}
								disabled={!selectedWorker || selectedWorker.totalUnits === 0}
							/>
						</View>
					</View>

					{/* Optional Notes */}
					<View className="mb-2">
						<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
							Closing Note / Remarks (Optional)
						</Text>
						<TextInput
							value={settleNote}
							onChangeText={setSettleNote}
							placeholder="e.g. Cash verified, van cleared..."
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white p-3 font-medium text-slate-900 text-xs dark:border-zinc-800 dark:bg-zinc-800 dark:text-white"
						/>
					</View>
				</ScrollView>
			</HeroBottomSheet>
		</Container>
	);
}
