import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { useProducts } from "@/hooks/queries/use-products";
import { useWorkerStock } from "@/hooks/queries/use-worker-stock";
import { useOrgUserRole } from "@/hooks/use-org-user-role";

export default function StockScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const { isOrgAdmin, isOrgWorker, orgRole } = useOrgUserRole();
	const isAdmin = isOrgAdmin;

	// Mode: For worker, strictly "VAN_STOCK" (Mera Van Stock), for Admin "WAREHOUSE"
	const [stockMode, setStockMode] = useState<"VAN_STOCK" | "WAREHOUSE">(
		isOrgAdmin ? "WAREHOUSE" : "VAN_STOCK",
	);

	// Sync mode when role resolves
	React.useEffect(() => {
		setStockMode(isOrgAdmin ? "WAREHOUSE" : "VAN_STOCK");
	}, [isOrgAdmin]);

	const [activeWarehouseTab, setActiveWarehouseTab] = useState<
		"STOCK" | "LOW_STOCK"
	>("STOCK");
	const [vanSearch, setVanSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);

	// Queries
	const {
		data: productsResponse,
		isLoading: isProductsLoading,
		refetch: refetchProducts,
	} = useProducts({ limit: 100, isActive: true });

	const {
		data: workerStockResponse,
		isLoading: isWorkerStockLoading,
		refetch: refetchWorkerStock,
	} = useWorkerStock();

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([refetchProducts(), refetchWorkerStock()]);
		} finally {
			setRefreshing(false);
		}
	};

	const warehouseProducts = productsResponse?.data || [];
	const myVanProducts = workerStockResponse?.data || [];

	// Worker Van Stock Aggregations (100% Real from Database)
	const vanStats = useMemo(() => {
		let totalUnits = 0;
		let totalCases = 0;
		let totalValue = 0;

		myVanProducts.forEach((item) => {
			const q = item.quantity || 0;
			const cases = item.stockInCases || 0;
			const rate = item.sellingRate || 0;
			totalUnits += q;
			totalCases += cases;
			totalValue += q * rate;
		});

		return {
			totalItems: myVanProducts.length,
			totalUnits,
			totalCases,
			totalValue,
		};
	}, [myVanProducts]);

	// Filtered Van Products for Search
	const filteredVanProducts = useMemo(() => {
		if (!vanSearch.trim()) return myVanProducts;
		const q = vanSearch.toLowerCase().trim();
		return myVanProducts.filter(
			(p) =>
				(p.productName || "").toLowerCase().includes(q) ||
				(p.sku && p.sku.toLowerCase().includes(q)) ||
				(p.packSize && p.packSize.toLowerCase().includes(q)),
		);
	}, [myVanProducts, vanSearch]);

	// Warehouse Stats
	const warehouseStats = useMemo(() => {
		let totalUnits = 0;
		let totalValue = 0;
		let totalCases = 0;
		let fastMovingCount = 0;
		let slowMovingCount = 0;
		let outOfStockCount = 0;
		const lowStockList: typeof warehouseProducts = [];

		warehouseProducts.forEach((p) => {
			const s = p.stock || 0;
			const unitsPerCase = p.unitsPerCase || 1;
			totalUnits += s;
			totalCases += Math.floor(s / unitsPerCase);
			const rate = p.purchaseRate || p.sellingRate || 0;
			totalValue += s * rate;

			if (s <= 0) {
				outOfStockCount++;
			}

			const minRequired = (p.minimumStock || 0) * unitsPerCase;
			if (s <= minRequired || s <= 10) {
				lowStockList.push(p);
				slowMovingCount++;
			} else {
				fastMovingCount++;
			}
		});

		const totalItems = warehouseProducts.length;
		const healthyCount = Math.max(0, totalItems - lowStockList.length);

		return {
			totalItems,
			totalUnits,
			totalCases,
			stockValue: totalValue,
			lowStockCount: lowStockList.length,
			lowStockList,
			fastMoving: fastMovingCount,
			slowMoving: slowMovingCount,
			outOfStockCount,
			healthyCount,
			healthyPct:
				totalItems > 0 ? Math.round((healthyCount / totalItems) * 100) : 0,
			lowPct:
				totalItems > 0
					? Math.round((lowStockList.length / totalItems) * 100)
					: 0,
		};
	}, [warehouseProducts]);

	return (
		<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
			{/* ══════════════════════════════════════════════════════════════════
			    HEADER (Role-Tailored: Clean Van Stock for Worker, Godown for Admin)
			══════════════════════════════════════════════════════════════════ */}
			<View className="border-slate-200/80 border-b bg-white px-4 pt-3 pb-3 dark:border-zinc-800 dark:bg-zinc-900">
				{isAdmin ? (
					<View className="flex-row items-center justify-between">
						<View>
							<Text className="font-black text-slate-900 text-xl tracking-tight dark:text-white">
								🏭 Godown Inventory
							</Text>
							<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
								Warehouse stock & worker allocation
							</Text>
						</View>
						<Pressable
							onPress={() => router.push("/stock/workers" as any)}
							className="flex-row items-center rounded-xl bg-teal-50 px-3 py-1.5 active:bg-teal-100 dark:bg-teal-950/40"
						>
							<Ionicons
								name="people"
								size={14}
								color="#0d9488"
								style={{ marginRight: 5 }}
							/>
							<Text className="font-bold text-teal-800 text-xs dark:text-teal-300">
								Workers Vans →
							</Text>
						</Pressable>
					</View>
				) : (
					<View>
						<Text className="font-black text-slate-900 text-xl tracking-tight dark:text-white">
							🚚 Mera Van Stock
						</Text>
						<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
							Aapki gaadi mein loaded live inventory
						</Text>
					</View>
				)}
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 12,
					paddingBottom: 40,
				}}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={themeAccent}
					/>
				}
			>
				{/* ══════════════════════════════════════════════════════════════
				    VIEW 1: MERA VAN STOCK (Cases-First Vehicle Inventory)
				══════════════════════════════════════════════════════════════ */}
				{stockMode === "VAN_STOCK" ? (
					<>
						{/* 1. HERO VAN INVENTORY KPI BANNER */}
						<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
								<View>
									<Text className="font-semibold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
										Current Van Inventory Load
									</Text>
									<View className="mt-1 flex-row items-baseline gap-2">
										<Text className="font-black text-3xl text-slate-900 tracking-tight dark:text-white">
											{vanStats.totalCases} Crates / Cases
										</Text>
									</View>
								</View>

								<View className="rounded-2xl bg-teal-50 px-3 py-1.5 dark:bg-teal-950/40">
									<Text className="font-black text-teal-800 text-xs dark:text-teal-300">
										{vanStats.totalUnits} Total Units
									</Text>
								</View>
							</View>

							{/* Financial Valuation & Quick Stats */}
							<View className="mt-3 flex-row items-center justify-between">
								<View>
									<Text className="font-semibold text-[11px] text-slate-400">
										Stock Value in Vehicle:
									</Text>
									<Text className="font-black text-emerald-600 text-lg dark:text-emerald-400">
										₹{vanStats.totalValue.toLocaleString("en-IN")}
									</Text>
								</View>

								{isAdmin ? (
									<View className="flex-row items-center gap-2">
										<Pressable
											onPress={() => router.push("/stock/return" as any)}
											className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 active:bg-rose-100 dark:border-rose-950 dark:bg-rose-950/30"
										>
											<Text className="font-bold text-rose-700 text-xs dark:text-rose-300">
												🔄 Return Stock
											</Text>
										</Pressable>

										<Pressable
											onPress={() => router.push("/stock/issue" as any)}
											className="rounded-xl bg-accent px-3 py-2 active:opacity-90"
										>
											<Text className="font-bold text-accent-foreground text-xs">
												+ Issue Stock
											</Text>
										</Pressable>
									</View>
								) : (
									<View className="flex-row items-center rounded-xl bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/40">
										<Ionicons
											name="checkmark-circle"
											size={14}
											color="#10b981"
											style={{ marginRight: 4 }}
										/>
										<Text className="font-bold text-[11px] text-emerald-800 dark:text-emerald-300">
											Loaded by Admin
										</Text>
									</View>
								)}
							</View>
						</Card>

						{/* 2. SEARCH IN VAN STOCK */}
						<View className="mb-3 flex-row items-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
							<Ionicons name="search" size={16} color="#94a3b8" />
							<TextInput
								value={vanSearch}
								onChangeText={setVanSearch}
								placeholder="Search products in your van..."
								placeholderTextColor="#94a3b8"
								className="ml-2 flex-1 font-medium text-slate-900 text-xs dark:text-white"
							/>
							{vanSearch.length > 0 && (
								<Pressable onPress={() => setVanSearch("")}>
									<Ionicons name="close-circle" size={16} color="#94a3b8" />
								</Pressable>
							)}
						</View>

						{/* 3. LIVE VEHICLE PRODUCT BREAKDOWN */}
						<View className="mb-2 flex-row items-center justify-between">
							<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
								Items on Vehicle ({filteredVanProducts.length})
							</Text>
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								Cases First Wholesale Format
							</Text>
						</View>

						{isWorkerStockLoading ? (
							<View className="items-center py-16">
								<ActivityIndicator size="small" color={themeAccent} />
								<Text className="mt-2 text-slate-400 text-xs">
									Loading vehicle inventory...
								</Text>
							</View>
						) : filteredVanProducts.length === 0 ? (
							<View className="items-center rounded-3xl border border-slate-100 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
								<Ionicons name="car-outline" size={48} color="#cbd5e1" />
								<Text className="mt-3 font-bold text-base text-slate-800 dark:text-zinc-200">
									Your Van is Empty
								</Text>
								<Text className="mt-1 text-center font-medium text-slate-400 text-xs leading-5">
									{isAdmin
										? "Aapki gaadi mein abhi koi stock nahi hai. Godown se stock issue karne ke liye niche tap karein."
										: "Aapki gaadi mein abhi koi stock nahi hai.\nSubah Godown Admin dwara maal load karne ke baad yahan dikhega."}
								</Text>

								{isAdmin && (
									<Pressable
										onPress={() => router.push("/stock/issue" as any)}
										className="mt-4 flex-row items-center rounded-2xl bg-accent px-5 py-2.5 shadow-sm active:opacity-90"
									>
										<Ionicons
											name="add"
											size={18}
											color="#ffffff"
											style={{ marginRight: 4 }}
										/>
										<Text className="font-bold text-accent-foreground text-xs">
											Issue Stock from Warehouse
										</Text>
									</Pressable>
								)}
							</View>
						) : (
							<View className="gap-2.5">
								{filteredVanProducts.map((p, index) => {
									const itemVal = (p.quantity || 0) * (p.sellingRate || 0);
									const pKey =
										p._id ||
										(typeof p.productId === "string"
											? p.productId
											: p.productId?._id) ||
										index;

									return (
										<Card
											key={String(pKey)}
											className="border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
										>
											<View className="flex-row items-start justify-between">
												<View className="flex-1 pr-3">
													<Text className="font-bold text-slate-900 text-sm dark:text-white">
														{p.productName || "Product"}
													</Text>
													<Text className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
														{p.sku ? `SKU: ${p.sku} • ` : ""}
														{p.packSize ? `${p.packSize} • ` : ""}
														{p.unitsPerCase} pcs/case
													</Text>
												</View>

												{/* Cases Badge */}
												<View className="items-end">
													<View className="flex-row items-center rounded-xl bg-teal-50 px-2.5 py-1 dark:bg-teal-950/60">
														<Ionicons
															name="cube"
															size={12}
															color="#0d9488"
															style={{ marginRight: 4 }}
														/>
														<Text className="font-black text-sm text-teal-800 dark:text-teal-200">
															{p.stockInCases || 0} cs
														</Text>
														{(p.remainingUnits || 0) > 0 && (
															<Text className="ml-1 font-bold text-teal-700 text-xs dark:text-teal-300">
																+{p.remainingUnits}
															</Text>
														)}
													</View>
													<Text className="mt-0.5 font-medium text-[10px] text-slate-400">
														{p.quantity} total {p.unit}
													</Text>
												</View>
											</View>

											{/* Bottom Valuation & Quick Bill Action */}
											<View className="mt-3 flex-row items-center justify-between border-slate-100 border-t pt-2.5 dark:border-zinc-800">
												<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-400">
													Value: ₹{itemVal.toLocaleString("en-IN")} (@ ₹
													{p.sellingRate})
												</Text>

												<View className="flex-row items-center gap-2">
													<Pressable
														onPress={() => router.push("/stock/return" as any)}
														className="rounded-lg bg-slate-100 px-2.5 py-1 active:bg-slate-200 dark:bg-zinc-800"
													>
														<Text className="font-bold text-[11px] text-slate-700 dark:text-zinc-300">
															Return
														</Text>
													</Pressable>

													<Pressable
														onPress={() =>
															router.push("/billing/create" as any)
														}
														className="rounded-lg bg-emerald-600 px-2.5 py-1 active:opacity-90"
													>
														<Text className="font-bold text-[11px] text-white">
															+ Bill
														</Text>
													</Pressable>
												</View>
											</View>
										</Card>
									);
								})}
							</View>
						)}
					</>
				) : (
					/* ══════════════════════════════════════════════════════════════
					    VIEW 2: GODOWN / WAREHOUSE STOCK
					══════════════════════════════════════════════════════════════ */
					<>
						{/* Segment Tabs (Stock vs Low Stock) */}
						<View className="mb-4 flex-row gap-3">
							<Pressable
								onPress={() => setActiveWarehouseTab("STOCK")}
								className={`flex-1 items-center justify-center rounded-2xl py-3 shadow-sm ${
									activeWarehouseTab === "STOCK"
										? "bg-accent"
										: "border border-slate-200/60 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<Text
									className={`font-bold text-sm ${
										activeWarehouseTab === "STOCK"
											? "text-accent-foreground"
											: "text-slate-600 dark:text-zinc-300"
									}`}
								>
									Godown Catalog ({warehouseStats.totalItems})
								</Text>
							</Pressable>

							<Pressable
								onPress={() => setActiveWarehouseTab("LOW_STOCK")}
								className={`flex-1 items-center justify-center rounded-2xl py-3 ${
									activeWarehouseTab === "LOW_STOCK"
										? "bg-accent shadow-sm"
										: "border border-slate-200/60 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<Text
									className={`font-bold text-sm ${
										activeWarehouseTab === "LOW_STOCK"
											? "text-accent-foreground"
											: "text-slate-600 dark:text-zinc-300"
									}`}
								>
									Low Stock ({warehouseStats.lowStockCount})
								</Text>
							</Pressable>
						</View>

						{activeWarehouseTab === "STOCK" ? (
							<>
								{/* 2x2 METRICS GRID */}
								<View className="mb-3 flex-row gap-3">
									{/* Total Warehouse Cases & Items */}
									<Pressable
										onPress={() => router.push("/stock/list" as any)}
										className="flex-1 rounded-2xl border border-emerald-100/80 bg-[#f0fdf4] p-3.5 shadow-sm active:opacity-90 dark:border-emerald-950/60 dark:bg-emerald-950/20"
									>
										<View className="flex-row items-center justify-between">
											<View className="flex-row items-center">
												<View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
													<Ionicons
														name="briefcase"
														size={15}
														color="#10b981"
													/>
												</View>
												<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
													Godown Cases
												</Text>
											</View>
											<Ionicons
												name="chevron-forward"
												size={14}
												color="#10b981"
											/>
										</View>
										<Text className="my-1 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
											{warehouseStats.totalCases} cs
										</Text>
										<View className="flex-row items-center">
											<Text className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400">
												View List →
											</Text>
											<Text className="ml-1 font-medium text-[11px] text-slate-400 dark:text-zinc-500">
												{warehouseStats.totalItems} items
											</Text>
										</View>
									</Pressable>

									{/* Total Stock Value */}
									<View className="flex-1 rounded-2xl border border-sky-100/80 bg-[#f0f9ff] p-3.5 shadow-sm dark:border-sky-950/60 dark:bg-sky-950/20">
										<View className="flex-row items-center">
											<View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15">
												<Ionicons name="receipt" size={15} color="#0284c7" />
											</View>
											<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
												Warehouse Value
											</Text>
										</View>
										<Text className="my-1 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
											₹{warehouseStats.stockValue.toLocaleString("en-IN")}
										</Text>
										<View className="flex-row items-center">
											<Text className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400">
												{warehouseStats.totalUnits.toLocaleString("en-IN")}
											</Text>
											<Text className="ml-1 font-medium text-[11px] text-slate-400 dark:text-zinc-500">
												total units
											</Text>
										</View>
									</View>
								</View>

								{/* 100% Real Database Inventory Health & Status Breakdown */}
								<View className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<View className="mb-3 flex-row items-center justify-between">
										<View className="flex-row items-center">
											<Ionicons
												name="pie-chart"
												size={18}
												color={themeAccent}
											/>
											<Text className="ml-2 font-bold text-base text-slate-900 dark:text-white">
												Inventory Health Status
											</Text>
										</View>
										<View className="rounded-lg bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/60">
											<Text className="font-bold text-[11px] text-emerald-700 dark:text-emerald-300">
												{warehouseStats.healthyPct}% In Good Health
											</Text>
										</View>
									</View>

									{/* Multi-segmented Live Distribution Bar */}
									<View className="h-2.5 w-full flex-row overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
										{warehouseStats.healthyCount > 0 && (
											<View
												className="h-full bg-emerald-500"
												style={{
													flex: warehouseStats.healthyCount,
												}}
											/>
										)}
										{warehouseStats.lowStockCount > 0 && (
											<View
												className="h-full bg-amber-500"
												style={{
													flex: warehouseStats.lowStockCount,
												}}
											/>
										)}
										{warehouseStats.outOfStockCount > 0 && (
											<View
												className="h-full bg-rose-500"
												style={{
													flex: warehouseStats.outOfStockCount,
												}}
											/>
										)}
									</View>

									{/* 3 Status Indicators */}
									<View className="mt-3.5 flex-row items-center justify-between">
										{/* Sufficient Stock */}
										<View className="flex-1 items-center border-slate-100 border-r pr-2 dark:border-zinc-800">
											<View className="flex-row items-center">
												<View className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />
												<Text className="font-medium text-[11px] text-slate-500 dark:text-zinc-400">
													In Stock
												</Text>
											</View>
											<Text className="mt-0.5 font-black text-emerald-700 text-sm dark:text-emerald-400">
												{warehouseStats.healthyCount} items
											</Text>
										</View>

										{/* Low Stock */}
										<Pressable
											onPress={() => setActiveWarehouseTab("LOW_STOCK")}
											className="flex-1 items-center border-slate-100 border-r px-2 dark:border-zinc-800"
										>
											<View className="flex-row items-center">
												<View className="mr-1.5 h-2 w-2 rounded-full bg-amber-500" />
												<Text className="font-medium text-[11px] text-slate-500 dark:text-zinc-400">
													Low Stock
												</Text>
											</View>
											<Text className="mt-0.5 font-black text-amber-600 text-sm dark:text-amber-400">
												{warehouseStats.lowStockCount} items
											</Text>
										</Pressable>

										{/* Out of Stock */}
										<View className="flex-1 items-center pl-2">
											<View className="flex-row items-center">
												<View className="mr-1.5 h-2 w-2 rounded-full bg-rose-500" />
												<Text className="font-medium text-[11px] text-slate-500 dark:text-zinc-400">
													Out of Stock
												</Text>
											</View>
											<Text className="mt-0.5 font-black text-rose-600 text-sm dark:text-rose-400">
												{warehouseStats.outOfStockCount} items
											</Text>
										</View>
									</View>
								</View>

								{/* All Workers Van Stock Closing Banner */}
								{isAdmin && (
									<Pressable
										onPress={() => router.push("/stock/workers" as any)}
										className="mb-4 flex-row items-center justify-between rounded-2xl border border-sky-200/80 bg-[#f0f9ff] p-4 shadow-sm active:opacity-90 dark:border-sky-900/60 dark:bg-sky-950/30"
									>
										<View className="flex-1 flex-row items-center pr-3">
											<View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15">
												<Ionicons name="car-sport" size={22} color="#0284c7" />
											</View>
											<View className="flex-1">
												<Text className="font-bold text-slate-900 text-sm dark:text-white">
													All Vans Stock & Day-End Closing
												</Text>
												<Text className="mt-0.5 font-medium text-slate-500 text-xs dark:text-zinc-400">
													Track live field inventory across all vans & drivers
												</Text>
											</View>
										</View>
										<View className="h-8 w-8 items-center justify-center rounded-full bg-white shadow-xs dark:bg-zinc-800">
											<Ionicons
												name="chevron-forward"
												size={16}
												color="#0284c7"
											/>
										</View>
									</Pressable>
								)}

								{/* Quick Actions */}
								<View className="mb-2">
									<Text className="mb-3 font-bold text-base text-slate-900 dark:text-white">
										Quick Warehouse Actions
									</Text>
									<View className="flex-row gap-3">
										<Pressable
											onPress={() => router.push("/stock/entry" as any)}
											className="flex-1 items-center justify-center rounded-2xl bg-accent px-2 py-4 shadow-sm active:opacity-90"
										>
											<Ionicons name="add" size={24} color="#ffffff" />
											<Text className="mt-1 font-bold text-accent-foreground text-xs">
												Add Godown Stock
											</Text>
										</Pressable>

										<Pressable
											onPress={() => router.push("/stock/issue" as any)}
											className="flex-1 items-center justify-center rounded-2xl bg-[#0d9488] px-2 py-4 shadow-sm active:opacity-90"
										>
											<Ionicons
												name="swap-horizontal"
												size={22}
												color="#ffffff"
											/>
											<Text className="mt-1 font-bold text-white text-xs">
												Issue to Van
											</Text>
										</Pressable>

										<Pressable
											onPress={() => router.push("/stock/workers" as any)}
											className="flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-2 py-4 shadow-sm active:opacity-90 dark:border-zinc-800 dark:bg-zinc-900"
										>
											<Ionicons
												name="people-outline"
												size={22}
												color={themeColorForeground}
											/>
											<Text className="mt-1 font-bold text-slate-800 text-xs dark:text-zinc-200">
												Workers Vans
											</Text>
										</Pressable>
									</View>
								</View>
							</>
						) : (
							/* Low Stock List */
							<View className="gap-2.5">
								<View className="mb-2 flex-row items-center justify-between">
									<Text className="font-bold text-slate-800 text-sm dark:text-zinc-200">
										Items Requiring Reorder
									</Text>
									<Text className="font-semibold text-red-500 text-xs">
										{warehouseStats.lowStockCount} items low
									</Text>
								</View>

								{isProductsLoading ? (
									<View className="items-center py-12">
										<ActivityIndicator size="small" color={themeAccent} />
									</View>
								) : warehouseStats.lowStockList.length === 0 ? (
									<View className="items-center rounded-2xl border border-slate-100 bg-white p-6 py-12 dark:border-zinc-800 dark:bg-zinc-900">
										<Ionicons
											name="checkmark-circle"
											size={36}
											color="#10b981"
										/>
										<Text className="mt-2 font-bold text-slate-900 text-sm dark:text-white">
											All Stock Levels are Healthy
										</Text>
										<Text className="text-slate-400 text-xs">
											No items are currently below minimum stock threshold.
										</Text>
									</View>
								) : (
									warehouseStats.lowStockList.map((p) => {
										const stock = p.stock || 0;
										const unitsPerCase = p.unitsPerCase || 1;
										const stockCases = Math.floor(stock / unitsPerCase);
										const remUnits = stock % unitsPerCase;
										const minCases = p.minimumStock || 0;

										return (
											<Card
												key={p._id}
												className="border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
											>
												<View className="flex-row items-center justify-between">
													<View className="flex-1 pr-2">
														<Text className="font-bold text-slate-900 text-sm dark:text-white">
															{p.name}
														</Text>
														<Text className="text-slate-500 text-xs">
															{p.sku ? `SKU: ${p.sku} • ` : ""}Min Alert:{" "}
															{minCases} cases
														</Text>
													</View>
													<View className="items-end">
														<Text className="font-black text-base text-red-500">
															{stockCases} cs{" "}
															{remUnits > 0 ? `+ ${remUnits} pcs` : ""}
														</Text>
														<Pressable
															onPress={() => router.push("/stock/entry" as any)}
															className="mt-1 rounded-md bg-accent px-2 py-0.5"
														>
															<Text className="font-bold text-[10px] text-accent-foreground">
																+ Refill
															</Text>
														</Pressable>
													</View>
												</View>
											</Card>
										);
									})
								)}
							</View>
						)}
					</>
				)}
			</ScrollView>
		</Container>
	);
}
