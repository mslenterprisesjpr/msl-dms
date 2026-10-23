import { Ionicons } from "@expo/vector-icons";
import { Card, useThemeColor } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Image,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { useAdminStats, useWorkerStats } from "@/hooks/queries/use-dashboard";
import {
	useProductSales,
	useSalesSummary,
	useStockSummary,
	useWorkerPerformance,
} from "@/hooks/queries/use-reports";
import { useUserRole } from "@/hooks/use-user-role";
import { useSession } from "@/lib/hooks/use-session";
import type { ReportPeriod } from "@/services/report.service";

type ReportTab = "SALES" | "PRODUCTS" | "WORKERS" | "STOCK";

const PERIODS: { label: string; value: ReportPeriod }[] = [
	{ label: "Today", value: "today" },
	{ label: "Week", value: "week" },
	{ label: "Month", value: "month" },
	{ label: "Year", value: "year" },
	{ label: "All Time", value: "all" },
];

export default function ReportsScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const { user } = useSession();
	const { isAdmin } = useUserRole();

	const [activeTab, setActiveTab] = useState<ReportTab>("SALES");
	const [period, setPeriod] = useState<ReportPeriod>("month");
	const [productSearch, setProductSearch] = useState("");
	const [stockFilter, setStockFilter] = useState<"ALL" | "LOW" | "OUT">("ALL");
	const [refreshing, setRefreshing] = useState(false);

	// Queries
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

	const {
		data: salesSummary,
		refetch: refetchSalesSummary,
		isLoading: isSalesLoading,
	} = useSalesSummary(period);

	const {
		data: productSales,
		refetch: refetchProductSales,
		isLoading: isProductsLoading,
	} = useProductSales(period);

	const {
		data: workerPerf,
		refetch: refetchWorkerPerf,
		isLoading: isWorkerPerfLoading,
	} = useWorkerPerformance(period);

	const {
		data: stockSummary,
		refetch: refetchStockSummary,
		isLoading: isStockLoading,
	} = useStockSummary();

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([
				isAdmin ? refetchAdminStats() : refetchWorkerStats(),
				refetchSalesSummary(),
				refetchProductSales(),
				refetchWorkerPerf(),
				refetchStockSummary(),
			]);
		} finally {
			setRefreshing(false);
		}
	};

	const stats = isAdmin ? adminStats : workerStats;
	const isDashboardLoading = isAdmin ? isAdminLoading : isWorkerLoading;

	// Today stats
	const todaySales = stats?.todaySales ?? 0;
	const todayCollection = stats?.todayCollection ?? 0;
	const todayCash = stats?.todayCash ?? 0;
	const todayUpi = stats?.todayUpi ?? 0;

	// Filtered Products for Product Sales Tab
	const filteredProducts = useMemo(() => {
		if (!productSales?.products) return [];
		if (!productSearch.trim()) return productSales.products;
		const query = productSearch.toLowerCase().trim();
		return productSales.products.filter(
			(p) =>
				p.productName.toLowerCase().includes(query) ||
				(p.sku && p.sku.toLowerCase().includes(query)),
		);
	}, [productSales?.products, productSearch]);

	// Filtered Stock Items for Stock Summary Tab
	const filteredStockProducts = useMemo(() => {
		if (!stockSummary?.products) return [];
		let list = stockSummary.products;
		if (stockFilter === "LOW") {
			list = list.filter((p) => p.isLowStock && p.totalStock > 0);
		} else if (stockFilter === "OUT") {
			list = list.filter((p) => p.totalStock === 0);
		}
		if (productSearch.trim()) {
			const query = productSearch.toLowerCase().trim();
			list = list.filter(
				(p) =>
					p.name.toLowerCase().includes(query) ||
					(p.sku && p.sku.toLowerCase().includes(query)),
			);
		}
		return list;
	}, [stockSummary?.products, stockFilter, productSearch]);

	// Calculate Max Revenue for Relative Bar Graphs
	const maxProductRevenue = useMemo(() => {
		if (!productSales?.products?.length) return 1;
		return Math.max(...productSales.products.map((p) => p.totalRevenue), 1);
	}, [productSales?.products]);

	const maxWorkerRevenue = useMemo(() => {
		if (!workerPerf?.workers?.length) return 1;
		return Math.max(...workerPerf.workers.map((w) => w.totalRevenue), 1);
	}, [workerPerf?.workers]);

	return (
		<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
			{/* ══════════════════════════════════════════════════════════════════
			    HEADER & SECTION TABS
			══════════════════════════════════════════════════════════════════ */}
			<View className="border-slate-200/80 border-b bg-white pt-2 dark:border-zinc-800 dark:bg-zinc-900">
				{/* Title row */}
				<View className="flex-row items-center justify-between px-4 pb-2">
					<View>
						<Text className="font-black text-slate-900 text-xl tracking-tight dark:text-white">
							Business Analytics
						</Text>
						<Text className="font-medium text-slate-400 text-xs dark:text-zinc-500">
							{isAdmin
								? "Enterprise Reports & Insights"
								: "My Performance Insights"}
						</Text>
					</View>

					{/* Role badge */}
					<View className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-zinc-800">
						<Text className="font-bold text-[10px] text-slate-600 uppercase tracking-wider dark:text-zinc-400">
							{isAdmin ? "👑 Admin View" : "👤 Worker View"}
						</Text>
					</View>
				</View>

				{/* 1. SECTION SWITCHER TABS (Boxy / Pill Tab Bar) */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{
						paddingHorizontal: 16,
						paddingBottom: 10,
						gap: 8,
					}}
				>
					<Pressable
						onPress={() => setActiveTab("SALES")}
						className={`flex-row items-center rounded-xl px-3.5 py-2 ${
							activeTab === "SALES"
								? "bg-slate-900 dark:bg-white"
								: "border border-slate-200/80 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-800/40"
						}`}
					>
						<Ionicons
							name="pie-chart"
							size={15}
							color={
								activeTab === "SALES"
									? themeColorForeground === "#ffffff"
										? "#09090b"
										: "#ffffff"
									: "#64748b"
							}
						/>
						<Text
							className={`ml-1.5 font-bold text-xs ${
								activeTab === "SALES"
									? "text-white dark:text-zinc-900"
									: "text-slate-600 dark:text-zinc-400"
							}`}
						>
							Sales & Revenue
						</Text>
					</Pressable>

					<Pressable
						onPress={() => setActiveTab("PRODUCTS")}
						className={`flex-row items-center rounded-xl px-3.5 py-2 ${
							activeTab === "PRODUCTS"
								? "bg-slate-900 dark:bg-white"
								: "border border-slate-200/80 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-800/40"
						}`}
					>
						<Ionicons
							name="cube"
							size={15}
							color={
								activeTab === "PRODUCTS"
									? themeColorForeground === "#ffffff"
										? "#09090b"
										: "#ffffff"
									: "#64748b"
							}
						/>
						<Text
							className={`ml-1.5 font-bold text-xs ${
								activeTab === "PRODUCTS"
									? "text-white dark:text-zinc-900"
									: "text-slate-600 dark:text-zinc-400"
							}`}
						>
							Top Products
						</Text>
					</Pressable>

					<Pressable
						onPress={() => setActiveTab("WORKERS")}
						className={`flex-row items-center rounded-xl px-3.5 py-2 ${
							activeTab === "WORKERS"
								? "bg-slate-900 dark:bg-white"
								: "border border-slate-200/80 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-800/40"
						}`}
					>
						<Ionicons
							name="people"
							size={15}
							color={
								activeTab === "WORKERS"
									? themeColorForeground === "#ffffff"
										? "#09090b"
										: "#ffffff"
									: "#64748b"
							}
						/>
						<Text
							className={`ml-1.5 font-bold text-xs ${
								activeTab === "WORKERS"
									? "text-white dark:text-zinc-900"
									: "text-slate-600 dark:text-zinc-400"
							}`}
						>
							Worker Performance
						</Text>
					</Pressable>

					<Pressable
						onPress={() => setActiveTab("STOCK")}
						className={`flex-row items-center rounded-xl px-3.5 py-2 ${
							activeTab === "STOCK"
								? "bg-slate-900 dark:bg-white"
								: "border border-slate-200/80 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-800/40"
						}`}
					>
						<Ionicons
							name="layers"
							size={15}
							color={
								activeTab === "STOCK"
									? themeColorForeground === "#ffffff"
										? "#09090b"
										: "#ffffff"
									: "#64748b"
							}
						/>
						<Text
							className={`ml-1.5 font-bold text-xs ${
								activeTab === "STOCK"
									? "text-white dark:text-zinc-900"
									: "text-slate-600 dark:text-zinc-400"
							}`}
						>
							Stock & Health
						</Text>
					</Pressable>
				</ScrollView>

				{/* 2. TIME PERIOD SELECTOR (for Sales, Products, and Workers tabs) */}
				{activeTab !== "STOCK" && (
					<View className="border-slate-100 border-t px-4 py-2 dark:border-zinc-800/60">
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ gap: 6 }}
						>
							{PERIODS.map((p) => {
								const isSelected = period === p.value;
								return (
									<Pressable
										key={p.value}
										onPress={() => setPeriod(p.value)}
										className={`rounded-lg px-2.5 py-1 ${
											isSelected
												? "bg-accent"
												: "bg-slate-100 dark:bg-zinc-800/80"
										}`}
									>
										<Text
											className={`font-bold text-xs ${
												isSelected
													? "text-accent-foreground"
													: "text-slate-500 dark:text-zinc-400"
											}`}
										>
											{p.label}
										</Text>
									</Pressable>
								);
							})}
						</ScrollView>
					</View>
				)}
			</View>

			{/* ══════════════════════════════════════════════════════════════════
			    BODY SCROLLVIEW
			══════════════════════════════════════════════════════════════════ */}
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
				    TAB 1: SALES & REVENUE (Sales Summary, Payments, Growth)
				══════════════════════════════════════════════════════════════ */}
				{activeTab === "SALES" && (
					<>
						{isSalesLoading ? (
							<View className="items-center py-20">
								<ActivityIndicator size="small" color={themeAccent} />
								<Text className="mt-2 text-slate-400 text-xs">
									Loading sales analytics...
								</Text>
							</View>
						) : (
							<View className="gap-3.5">
								{/* HERO REVENUE KPI CARD */}
								<Card className="border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
										<View>
											<Text className="font-semibold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
												Gross Revenue ({period.toUpperCase()})
											</Text>
											<Text className="my-1 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
												₹
												{(
													salesSummary?.summary?.totalRevenue || 0
												).toLocaleString("en-IN")}
											</Text>
										</View>
										<View className="rounded-2xl bg-emerald-50 px-3 py-1.5 dark:bg-emerald-950/40">
											<Text className="font-black text-emerald-700 text-xs dark:text-emerald-300">
												{salesSummary?.summary?.totalSales || 0} Bills Booked
											</Text>
										</View>
									</View>

									{/* Received vs Pending Split Bar */}
									<View className="mt-3">
										<View className="mb-1.5 flex-row justify-between text-xs">
											<Text className="font-bold text-emerald-600 text-xs dark:text-emerald-400">
												Collected: ₹
												{(salesSummary?.summary?.totalPaid || 0).toLocaleString(
													"en-IN",
												)}
											</Text>
											<Text className="font-bold text-rose-600 text-xs dark:text-rose-400">
												Pending Due: ₹
												{(
													salesSummary?.summary?.totalPending || 0
												).toLocaleString("en-IN")}
											</Text>
										</View>

										{/* Progress Bar */}
										{(() => {
											const total =
												(salesSummary?.summary?.totalPaid || 0) +
												(salesSummary?.summary?.totalPending || 0);
											const paidRatio =
												total > 0
													? Math.min(
															Math.max(
																(salesSummary?.summary?.totalPaid || 0) / total,
																0,
															),
															1,
														)
													: 0;
											const paidPercent = Math.round(paidRatio * 100);

											return (
												<View className="h-2.5 w-full flex-row overflow-hidden rounded-full bg-rose-100 dark:bg-rose-950/60">
													<View
														style={{ width: `${paidPercent}%` }}
														className="h-full bg-emerald-500"
													/>
												</View>
											);
										})()}

										<Text className="mt-1 text-right text-[10px] text-slate-400">
											{salesSummary?.summary?.totalRevenue
												? `${Math.round(
														((salesSummary.summary.totalPaid || 0) /
															salesSummary.summary.totalRevenue) *
															100,
													)}% Collection Recovery Rate`
												: "0% Collection Rate"}
										</Text>
									</View>
								</Card>

								{/* PAYMENT METHODS BREAKDOWN (Cash vs UPI vs Others) */}
								<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
									Payment Method Breakdown
								</Text>
								<Card className="border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
									{salesSummary?.paymentBreakdown &&
									salesSummary.paymentBreakdown.length > 0 ? (
										<View className="gap-2.5">
											{salesSummary.paymentBreakdown.map((pm) => {
												const totalAll = salesSummary.paymentBreakdown.reduce(
													(sum, p) => sum + p.total,
													0,
												);
												const ratio =
													totalAll > 0
														? Math.round((pm.total / totalAll) * 100)
														: 0;

												const isCash = pm._id === "CASH";
												const isUpi = pm._id === "UPI";

												return (
													<View key={pm._id}>
														<View className="mb-1 flex-row items-center justify-between">
															<View className="flex-row items-center">
																<Ionicons
																	name={
																		isCash
																			? "cash-outline"
																			: isUpi
																				? "flash-outline"
																				: "card-outline"
																	}
																	size={16}
																	color={
																		isCash
																			? "#10b981"
																			: isUpi
																				? "#0d9488"
																				: "#6366f1"
																	}
																/>
																<Text className="ml-1.5 font-bold text-slate-800 text-xs dark:text-white">
																	{isCash
																		? "Cash Collection"
																		: isUpi
																			? "UPI / QR Payments"
																			: `${pm._id} Payments`}
																</Text>
																<Text className="ml-1 text-[11px] text-slate-400">
																	({pm.count} txns)
																</Text>
															</View>

															<Text className="font-black text-slate-900 text-xs dark:text-white">
																₹{pm.total.toLocaleString("en-IN")}{" "}
																<Text className="font-normal text-[10px] text-slate-400">
																	({ratio}%)
																</Text>
															</Text>
														</View>

														<View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
															<View
																style={{ width: `${ratio}%` }}
																className={`h-full ${
																	isCash
																		? "bg-emerald-500"
																		: isUpi
																			? "bg-teal-500"
																			: "bg-indigo-500"
																}`}
															/>
														</View>
													</View>
												);
											})}
										</View>
									) : (
										<Text className="py-2 text-center text-slate-400 text-xs">
											No payment transactions recorded for this period.
										</Text>
									)}
								</Card>

								{/* TODAY'S INSTANT CASH IN HAND STRIP */}
								<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
									Today's Real-time Vault
								</Text>
								<View className="flex-row gap-3">
									<Card className="flex-1 border-slate-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
										<View className="flex-row items-center justify-between">
											<Text className="font-semibold text-slate-500 text-xs">
												Cash in Hand
											</Text>
											<Ionicons name="cash" size={16} color="#10b981" />
										</View>
										<Text className="mt-1 font-black text-emerald-600 text-lg dark:text-emerald-400">
											₹{todayCash.toLocaleString("en-IN")}
										</Text>
										<Text className="text-[10px] text-slate-400">
											Today cash
										</Text>
									</Card>

									<Card className="flex-1 border-slate-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
										<View className="flex-row items-center justify-between">
											<Text className="font-semibold text-slate-500 text-xs">
												UPI / Bank
											</Text>
											<Ionicons name="flash" size={16} color="#0d9488" />
										</View>
										<Text className="mt-1 font-black text-lg text-teal-600 dark:text-teal-400">
											₹{todayUpi.toLocaleString("en-IN")}
										</Text>
										<Text className="text-[10px] text-slate-400">
											Today online
										</Text>
									</Card>
								</View>
							</View>
						)}
					</>
				)}

				{/* ══════════════════════════════════════════════════════════════
				    TAB 2: TOP SELLING PRODUCTS (Cases Sold, Revenue, Rank)
				══════════════════════════════════════════════════════════════ */}
				{activeTab === "PRODUCTS" && (
					<>
						{/* Search Bar for Products */}
						<View className="mb-3 flex-row items-center rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
							<Ionicons name="search" size={16} color="#94a3b8" />
							<TextInput
								value={productSearch}
								onChangeText={setProductSearch}
								placeholder="Search product name or SKU..."
								placeholderTextColor="#94a3b8"
								className="ml-2 flex-1 font-medium text-slate-900 text-xs dark:text-white"
							/>
							{productSearch.length > 0 && (
								<Pressable onPress={() => setProductSearch("")}>
									<Ionicons name="close-circle" size={16} color="#94a3b8" />
								</Pressable>
							)}
						</View>

						{isProductsLoading ? (
							<View className="items-center py-20">
								<ActivityIndicator size="small" color={themeAccent} />
								<Text className="mt-2 text-slate-400 text-xs">
									Aggregating product sales...
								</Text>
							</View>
						) : filteredProducts.length === 0 ? (
							<View className="items-center py-16">
								<Ionicons name="cube-outline" size={40} color="#cbd5e1" />
								<Text className="mt-2 font-bold text-slate-700 text-sm dark:text-zinc-300">
									No Product Sales Found
								</Text>
								<Text className="text-slate-400 text-xs">
									No bills recorded with items during this {period}.
								</Text>
							</View>
						) : (
							<View className="gap-2.5">
								{filteredProducts.map((p, index) => {
									const ratio = Math.round(
										(p.totalRevenue / maxProductRevenue) * 100,
									);
									const isTop3 = index < 3;
									const badgeColor =
										index === 0
											? "bg-amber-400 text-amber-950"
											: index === 1
												? "bg-slate-300 text-slate-800"
												: index === 2
													? "bg-amber-700/60 text-white"
													: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400";

									return (
										<Card
											key={p.productId || index}
											className="border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
										>
											<View className="flex-row items-start justify-between">
												{/* Left: Rank & Product Details */}
												<View className="mr-3 flex-1 flex-row items-start">
													<View
														className={`mr-2.5 h-6 w-6 items-center justify-center rounded-lg ${badgeColor}`}
													>
														<Text className="font-black text-xs">
															{index + 1}
														</Text>
													</View>

													<View className="flex-1">
														<Text className="font-bold text-slate-900 text-sm dark:text-white">
															{p.productName}
														</Text>
														<Text className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
															{p.sku ? `SKU: ${p.sku} • ` : ""}
															{p.salesCount} orders
														</Text>
													</View>
												</View>

												{/* Right: Revenue */}
												<View className="items-end">
													<Text className="font-black text-base text-slate-900 dark:text-white">
														₹{p.totalRevenue.toLocaleString("en-IN")}
													</Text>
													<Text className="font-medium text-[10px] text-slate-400">
														Revenue
													</Text>
												</View>
											</View>

											{/* Cases First Volume Strip */}
											<View className="mt-2.5 flex-row items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-zinc-800/60">
												<View className="flex-row items-center">
													<Ionicons
														name="cart-outline"
														size={14}
														color="#0d9488"
													/>
													<Text className="ml-1.5 font-bold text-slate-700 text-xs dark:text-zinc-200">
														Volume Sold:
													</Text>
												</View>

												<View className="flex-row items-center gap-1.5">
													{p.totalCases > 0 && (
														<View className="rounded-md bg-teal-100 px-2 py-0.5 dark:bg-teal-950">
															<Text className="font-black text-teal-800 text-xs dark:text-teal-200">
																{p.totalCases} Cases
															</Text>
														</View>
													)}
													<Text className="font-bold text-slate-500 text-xs">
														({p.totalQuantity} total pcs)
													</Text>
												</View>
											</View>

											{/* Relative Revenue Bar */}
											<View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
												<View
													style={{ width: `${ratio}%` }}
													className={`h-full ${
														isTop3 ? "bg-accent" : "bg-slate-400"
													}`}
												/>
											</View>
										</Card>
									);
								})}
							</View>
						)}
					</>
				)}

				{/* ══════════════════════════════════════════════════════════════
				    TAB 3: WORKER PERFORMANCE (Sales, Recovery Rate, Average)
				══════════════════════════════════════════════════════════════ */}
				{activeTab === "WORKERS" && (
					<>
						{isWorkerPerfLoading ? (
							<View className="items-center py-20">
								<ActivityIndicator size="small" color={themeAccent} />
								<Text className="mt-2 text-slate-400 text-xs">
									Loading worker scores...
								</Text>
							</View>
						) : !workerPerf?.workers || workerPerf.workers.length === 0 ? (
							<View className="items-center py-16">
								<Ionicons name="people-outline" size={40} color="#cbd5e1" />
								<Text className="mt-2 font-bold text-slate-700 text-sm dark:text-zinc-300">
									No Worker Data Recorded
								</Text>
								<Text className="text-slate-400 text-xs">
									No bills associated with sales reps for this period.
								</Text>
							</View>
						) : (
							<View className="gap-3">
								{workerPerf.workers.map((w, index) => {
									const ratio = Math.round(
										(w.totalRevenue / maxWorkerRevenue) * 100,
									);
									const isTopWorker = index === 0;

									return (
										<Card
											key={w.workerId || index}
											className="border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
										>
											{/* Header row */}
											<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
												<View className="flex-row items-center">
													<View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-accent/15">
														<Ionicons
															name="person"
															size={20}
															color={themeAccent}
														/>
													</View>
													<View>
														<View className="flex-row items-center gap-1.5">
															<Text className="font-bold text-slate-900 text-sm dark:text-white">
																{w.workerName}
															</Text>
															{isTopWorker && (
																<Text className="text-xs">🏆</Text>
															)}
														</View>
														<Text className="text-[11px] text-slate-400">
															{w.totalSales} bills booked • Avg ₹
															{w.avgSaleValue.toLocaleString("en-IN")}/bill
														</Text>
													</View>
												</View>

												<View className="items-end">
													<Text className="font-black text-base text-slate-900 dark:text-white">
														₹{w.totalRevenue.toLocaleString("en-IN")}
													</Text>
													<Text className="font-semibold text-[10px] text-slate-400">
														Total Sales
													</Text>
												</View>
											</View>

											{/* Performance Metrics Grid */}
											<View className="my-3 flex-row gap-2">
												{/* Collected */}
												<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
													<Text className="font-semibold text-[10px] text-emerald-600">
														COLLECTED
													</Text>
													<Text className="font-bold text-emerald-600 text-sm">
														₹{w.totalPaid.toLocaleString("en-IN")}
													</Text>
												</View>

												{/* Pending Due */}
												<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
													<Text className="font-semibold text-[10px] text-rose-600">
														PENDING
													</Text>
													<Text className="font-bold text-rose-600 text-sm">
														₹{w.totalPending.toLocaleString("en-IN")}
													</Text>
												</View>

												{/* Recovery % */}
												<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
													<Text className="font-semibold text-[10px] text-sky-600">
														RECOVERY
													</Text>
													<Text className="font-bold text-sky-600 text-sm">
														{w.collectionRate}%
													</Text>
												</View>
											</View>

											{/* Revenue volume indicator */}
											<View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
												<View
													style={{ width: `${ratio}%` }}
													className="h-full bg-accent"
												/>
											</View>
										</Card>
									);
								})}
							</View>
						)}
					</>
				)}

				{/* ══════════════════════════════════════════════════════════════
				    TAB 4: STOCK & ECOSYSTEM HEALTH (Warehouse vs Van, Low Stock)
				══════════════════════════════════════════════════════════════ */}
				{activeTab === "STOCK" && (
					<>
						{isStockLoading ? (
							<View className="items-center py-20">
								<ActivityIndicator size="small" color={themeAccent} />
								<Text className="mt-2 text-slate-400 text-xs">
									Auditing warehouse & van stock...
								</Text>
							</View>
						) : (
							<View className="gap-3.5">
								{/* KPI Cards Strip */}
								<View className="flex-row gap-2">
									<Card className="flex-1 border-slate-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
										<Text className="font-semibold text-[10px] text-slate-400">
											TOTAL PRODUCTS
										</Text>
										<Text className="mt-0.5 font-black text-slate-900 text-xl dark:text-white">
											{stockSummary?.summary?.totalProducts || 0}
										</Text>
										<Text className="text-[10px] text-slate-400">
											In catalog
										</Text>
									</Card>

									<Card className="flex-1 border-rose-200 bg-rose-50/70 p-3 shadow-sm dark:border-rose-950/60 dark:bg-rose-950/25">
										<Text className="font-semibold text-[10px] text-rose-700 dark:text-rose-300">
											LOW STOCK
										</Text>
										<Text className="mt-0.5 font-black text-rose-700 text-xl dark:text-rose-400">
											{stockSummary?.summary?.lowStockProducts || 0}
										</Text>
										<Text className="text-[10px] text-rose-600/80">
											Reorder needed
										</Text>
									</Card>

									<Card className="flex-1 border-slate-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
										<Text className="font-semibold text-[10px] text-slate-400">
											VAN STOCK
										</Text>
										<Text className="mt-0.5 font-black text-teal-600 text-xl">
											{stockSummary?.summary?.totalWorkerStock || 0}
										</Text>
										<Text className="text-[10px] text-slate-400">
											With workers
										</Text>
									</Card>
								</View>

								{/* Stock Filter Pills */}
								<View className="flex-row gap-2">
									{(["ALL", "LOW", "OUT"] as const).map((filter) => {
										const isSelected = stockFilter === filter;
										return (
											<Pressable
												key={filter}
												onPress={() => setStockFilter(filter)}
												className={`rounded-xl px-3 py-1.5 ${
													isSelected
														? "bg-slate-900 dark:bg-white"
														: "border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
												}`}
											>
												<Text
													className={`font-bold text-xs ${
														isSelected
															? "text-white dark:text-zinc-900"
															: "text-slate-600 dark:text-zinc-400"
													}`}
												>
													{filter === "ALL"
														? "All Products"
														: filter === "LOW"
															? "⚠️ Low Stock Only"
															: "❌ Out of Stock"}
												</Text>
											</Pressable>
										);
									})}
								</View>

								{/* Products Stock List */}
								{filteredStockProducts.length === 0 ? (
									<View className="items-center py-12">
										<Text className="font-bold text-slate-500 text-sm">
											No products match this stock filter.
										</Text>
									</View>
								) : (
									<View className="gap-2.5">
										{filteredStockProducts.map((item) => (
											<Card
												key={item.productId}
												className={`border p-3.5 shadow-sm ${
													item.totalStock === 0
														? "border-rose-300 bg-rose-50/40 dark:border-rose-950 dark:bg-rose-950/20"
														: item.isLowStock
															? "border-amber-300 bg-amber-50/30 dark:border-amber-950 dark:bg-amber-950/20"
															: "border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
												}`}
											>
												<View className="flex-row items-start justify-between">
													<View className="flex-1 pr-2">
														<View className="flex-row items-center gap-1.5">
															<Text className="font-bold text-slate-900 text-sm dark:text-white">
																{item.name}
															</Text>
															{item.isLowStock && (
																<View className="rounded bg-rose-100 px-1.5 py-0.2 dark:bg-rose-950">
																	<Text className="font-black text-[9px] text-rose-700 dark:text-rose-300">
																		LOW
																	</Text>
																</View>
															)}
														</View>
														<Text className="mt-0.5 text-[11px] text-slate-400">
															{item.sku ? `SKU: ${item.sku} • ` : ""}
															Min Alert: {item.minimumStock} cases
														</Text>
													</View>

													<View className="items-end">
														<Text className="font-black text-base text-slate-900 dark:text-white">
															{item.totalStock} pcs
														</Text>
														<Text className="font-medium text-[10px] text-slate-400">
															Total in System
														</Text>
													</View>
												</View>

												{/* Cases Distribution Grid */}
												<View className="mt-2.5 flex-row gap-2">
													{/* Warehouse */}
													<View className="flex-1 rounded-xl bg-slate-50 p-2 dark:bg-zinc-800/60">
														<Text className="font-semibold text-[10px] text-slate-400">
															WAREHOUSE
														</Text>
														<Text className="font-black text-slate-800 text-xs dark:text-zinc-200">
															{item.warehouseStockInCases} cs{" "}
															{item.warehouseRemainingUnits > 0
																? `+ ${item.warehouseRemainingUnits} pcs`
																: ""}
														</Text>
													</View>

													{/* Worker Vans */}
													<View className="flex-1 rounded-xl bg-slate-50 p-2 dark:bg-zinc-800/60">
														<Text className="font-semibold text-[10px] text-slate-400">
															WITH WORKERS
														</Text>
														<Text className="font-black text-teal-700 text-xs dark:text-teal-300">
															{item.workerStock} pcs ({item.workersWithStock}{" "}
															vans)
														</Text>
													</View>
												</View>
											</Card>
										))}
									</View>
								)}
							</View>
						)}
					</>
				)}
			</ScrollView>
		</Container>
	);
}
