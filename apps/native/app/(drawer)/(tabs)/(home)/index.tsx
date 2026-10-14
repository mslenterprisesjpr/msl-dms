import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { Input, useThemeColor, useToast } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	useColorScheme,
	View,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { Container } from "@/components/container";
import { DialogModal } from "@/components/dialog-modal";
import { useCustomers } from "@/hooks/queries/use-customers";
import { useAdminStats, useWorkerStats } from "@/hooks/queries/use-dashboard";
import { useProducts } from "@/hooks/queries/use-products";
import { useCreateSale, useSales } from "@/hooks/queries/use-sales";
import { useSession } from "@/lib/hooks/use-session";
import { useOrganizationStore } from "@/lib/stores/organization-store";

// Custom UPI Icon replicating the dual-chevron payment mark
function UpiBadgeIcon({ size = 18 }: { size?: number }) {
	const isDark = useColorScheme() === "dark";
	return (
		<View className="flex-row items-center justify-center">
			<Ionicons
				name="chevron-forward"
				size={size}
				color="#0d9488"
				style={{ marginRight: -size * 0.45 }}
			/>
			<Ionicons
				name="chevron-forward"
				size={size}
				color={isDark ? "#94a3b8" : "#1e293b"}
			/>
		</View>
	);
}

// Custom Banknote Icon badge
function CashBadgeIcon({ size = 18 }: { size?: number }) {
	return (
		<View className="flex-row items-center justify-center rounded border border-emerald-500/80 px-1 py-0.5">
			<Ionicons name="cash-outline" size={size} color="#10b981" />
		</View>
	);
}

// Quick Action Custom SVG Icons with Dark Mode Support
function AddBillIcon() {
	return (
		<Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
			<Path
				d="M 6 4 C 6 2.8, 6.8 2, 8 2 L 19 2 L 26 9 L 26 28 C 26 29.2, 25.2 30, 24 30 L 8 30 C 6.8 30, 6 29.2, 6 28 Z"
				fill="#f59e0b"
			/>
			<Path d="M 19 2 L 19 9 L 26 9 Z" fill="#d97706" />
			<Path
				d="M 16 12 L 16 22 M 11 17 L 21 17"
				stroke="#0f274a"
				strokeWidth={3}
				strokeLinecap="round"
			/>
		</Svg>
	);
}

function AddStockIcon() {
	const isDark = useColorScheme() === "dark";
	const iconColor = isDark ? "#38bdf8" : "#0f274a";
	const innerColor = isDark ? "#0f274a" : "#ffffff";
	return (
		<Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
			<Rect x={13} y={2} width={6} height={3} rx={1} fill={iconColor} />
			<Rect x={14} y={5} width={4} height={3} fill={iconColor} />
			<Path
				d="M 9 9 C 9 8, 9.8 8, 11 8 L 21 8 C 22.2 8, 23 8, 23 9 L 24 27 C 24 28.5, 23 29.5, 21.5 29.5 L 10.5 29.5 C 9 29.5, 8 28.5, 8 27 Z"
				fill={iconColor}
			/>
			<Path
				d="M 16 14 L 16 22 M 12 18 L 20 18"
				stroke={innerColor}
				strokeWidth={2.5}
				strokeLinecap="round"
			/>
		</Svg>
	);
}

function StockReportIcon() {
	const isDark = useColorScheme() === "dark";
	const iconColor = isDark ? "#38bdf8" : "#0f274a";
	const innerColor = isDark ? "#0f274a" : "#ffffff";
	return (
		<Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
			<Rect x={13} y={2} width={6} height={3} rx={1} fill={iconColor} />
			<Rect x={14} y={5} width={4} height={3} fill={iconColor} />
			<Path
				d="M 9 9 C 9 8, 9.8 8, 11 8 L 21 8 C 22.2 8, 23 8, 23 9 L 24 27 C 24 28.5, 23 29.5, 21.5 29.5 L 10.5 29.5 C 9 29.5, 8 28.5, 8 27 Z"
				fill={iconColor}
			/>
			<Path
				d="M 12 15 L 20 15 M 12 19 L 20 19 M 12 23 L 18 23"
				stroke={innerColor}
				strokeWidth={2}
				strokeLinecap="round"
			/>
		</Svg>
	);
}

function SalesReportIcon() {
	const isDark = useColorScheme() === "dark";
	const iconColor = isDark ? "#38bdf8" : "#0f274a";
	const cornerColor = isDark ? "#0284c7" : "#1e3a8a";
	const innerColor = isDark ? "#0f274a" : "#ffffff";
	return (
		<Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
			<Path
				d="M 6 4 C 6 2.8, 6.8 2, 8 2 L 19 2 L 26 9 L 26 28 C 26 29.2, 25.2 30, 24 30 L 8 30 C 6.8 30, 6 29.2, 6 28 Z"
				fill={iconColor}
			/>
			<Path d="M 19 2 L 19 9 L 26 9 Z" fill={cornerColor} />
			<Rect x={10} y={20} width={3} height={6} rx={0.5} fill={innerColor} />
			<Rect x={14.5} y={16} width={3} height={10} rx={0.5} fill={innerColor} />
			<Rect x={19} y={12} width={3} height={14} rx={0.5} fill={innerColor} />
		</Svg>
	);
}

export default function Home() {
	const themeAccent = useThemeColor("accent");
	const navigation = useNavigation();
	const {
		user,
		isLoading: isSessionLoading,
		refetch: refetchSession,
	} = useSession();
	const currentOrg = useOrganizationStore((state) => state.getCurrentOrg());
	const { toast } = useToast();

	const [refreshing, setRefreshing] = useState(false);
	const [createBillModalVisible, setCreateBillModalVisible] = useState(false);

	// New Bill Form State
	const [selectedCustomerId, setSelectedCustomerId] = useState("");
	const [billAmount, setBillAmount] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
	const [isSubmittingBill, setIsSubmittingBill] = useState(false);

	const isAdmin = user?.role === "admin";
	const isWorker = !isAdmin;

	// Real Data Queries
	const {
		data: adminStats,
		refetch: refetchAdminStats,
		isLoading: isAdminLoading,
	} = useAdminStats({ enabled: isAdmin });

	const {
		data: workerStats,
		refetch: refetchWorkerStats,
		isLoading: isWorkerLoading,
	} = useWorkerStats(user?.id, { enabled: isWorker });

	const {
		data: salesResponse,
		refetch: refetchSales,
		isLoading: isSalesLoading,
	} = useSales({ limit: 5 });

	const {
		data: productsResponse,
		refetch: refetchProducts,
		isLoading: isProductsLoading,
	} = useProducts({ limit: 50, isActive: true });

	const { data: customersResponse } = useCustomers({ limit: 20 });
	const createSaleMutation = useCreateSale();

	// Update navigation title with real active organization name
	React.useEffect(() => {
		const orgTitle = currentOrg?.name || "MSL Enterprises";
		navigation.setOptions({
			headerTitle: orgTitle,
		});
	}, [currentOrg, navigation]);

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		try {
			await Promise.all([
				refetchSession(),
				isAdmin ? refetchAdminStats() : refetchWorkerStats(),
				refetchSales(),
				refetchProducts(),
			]);
		} catch (error) {
			console.error("Refresh error:", error);
		} finally {
			setRefreshing(false);
		}
	}, [
		refetchSession,
		isAdmin,
		refetchAdminStats,
		refetchWorkerStats,
		refetchSales,
		refetchProducts,
	]);

	// REAL KPI Values from backend (no dummy data)
	const activeStats = isAdmin ? adminStats : workerStats;

	const todaySales = activeStats?.todaySales ?? 0;
	const billsCount = activeStats?.todayBillsCount ?? 0;
	const cashAmount = activeStats?.todayCash ?? 0;
	const upiAmount = activeStats?.todayUpi ?? 0;
	const growthPercentage = activeStats?.growthPercentage ?? 0;

	// REAL Low Stock Items from Database
	const lowStockAlerts = useMemo(() => {
		const products = productsResponse?.data || [];
		return products
			.filter((p) => {
				const stock = p.stock ?? 0;
				const min = (p.minimumStock || 0) * (p.unitsPerCase || 1);
				return stock <= min || stock <= 10;
			})
			.slice(0, 5)
			.map((p) => {
				const stock = p.stock ?? 0;
				return {
					id: p._id,
					name: `${p.name}${p.packSize ? ` ${p.packSize}` : ""}`.trim(),
					quantity: `${stock} ${p.unit || "pcs"}`,
					isCritical: stock <= 3,
				};
			});
	}, [productsResponse?.data]);

	// REAL Recent Bills from Database
	const recentBills = useMemo(() => {
		const sales = salesResponse?.data || [];
		return sales.slice(0, 5).map((sale) => {
			const timeStr = sale.createdAt
				? new Date(sale.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})
				: "--:--";
			return {
				id: sale._id,
				billNo: sale.invoiceNo
					? `#${sale.invoiceNo}`
					: `#BILL-${sale._id.slice(-4).toUpperCase()}`,
				amount: `₹${(sale.total || 0).toLocaleString("en-IN")}`,
				time: timeStr,
			};
		});
	}, [salesResponse?.data]);

	// Handle Create Bill Submission (Saves real record to DB)
	const handleCreateBill = async () => {
		const numericAmount = Number.parseFloat(billAmount);
		if (!numericAmount || numericAmount <= 0) {
			toast.show({
				variant: "danger",
				label: "Please enter a valid bill amount",
			});
			return;
		}

		setIsSubmittingBill(true);
		try {
			const invoiceNo = `BILL-${Date.now().toString().slice(-4)}`;
			const customerId =
				selectedCustomerId ||
				customersResponse?.data?.[0]?._id ||
				"WALK_IN_CUSTOMER";

			await createSaleMutation.mutateAsync({
				invoiceNo,
				customerId,
				workerId: user?.id || "DIRECT",
				total: numericAmount,
				subtotal: numericAmount,
				paidAmount: numericAmount,
				pendingAmount: 0,
				paymentStatus: "PAID",
				status: "CONFIRMED",
				createdBy: user?.id || "DIRECT",
			});

			toast.show({
				variant: "success",
				label: `Bill ${invoiceNo} created successfully!`,
			});
			setBillAmount("");
			setSelectedCustomerId("");
			setCreateBillModalVisible(false);

			// Refresh dashboard to show the newly created bill and updated sales
			await onRefresh();
		} catch (error: any) {
			console.error("Bill creation error:", error);
			toast.show({
				variant: "danger",
				label: error?.message || "Failed to create bill",
			});
		} finally {
			setIsSubmittingBill(false);
		}
	};

	const isLoadingInitial =
		isSessionLoading || (isAdmin ? isAdminLoading : isWorkerLoading);

	return (
		<Container
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
			isScrollable={false}
		>
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 12,
					paddingBottom: 24,
				}}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={themeAccent}
						colors={[themeAccent]}
					/>
				}
			>
				{/* 2x2 STATS CARDS GRID */}
				{/* ROW 1: Today's Sales & Bills */}
				<View className="mb-3 flex-row gap-3">
					{/* Today's Sales */}
					<View className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-semibold text-slate-800 text-sm dark:text-zinc-200">
								Today's Sales
							</Text>
							<Ionicons name="stats-chart" size={18} color="#0d9488" />
						</View>
						<Text className="my-1.5 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
							₹{todaySales.toLocaleString("en-IN")}
						</Text>
						<View className="flex-row items-center">
							<Text
								className={`font-bold text-xs ${
									growthPercentage >= 0
										? "text-emerald-600 dark:text-emerald-400"
										: "text-red-500"
								}`}
							>
								{growthPercentage >= 0 ? "↑" : "↓"} {Math.abs(growthPercentage)}
								%
							</Text>
							<Text className="ml-1 font-medium text-slate-400 text-xs dark:text-zinc-500">
								vs yesterday
							</Text>
						</View>
					</View>

					{/* Bills */}
					<View className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-semibold text-slate-800 text-sm dark:text-zinc-200">
								Bills
							</Text>
							<Ionicons name="receipt-outline" size={19} color="#64748b" />
						</View>
						<Text className="my-1.5 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
							{billsCount}
						</Text>
						<View className="h-4" />
					</View>
				</View>

				{/* ROW 2: Cash & UPI */}
				<View className="mb-4 flex-row gap-3">
					{/* Cash */}
					<View className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-semibold text-slate-800 text-sm dark:text-zinc-200">
								Cash
							</Text>
							<CashBadgeIcon size={16} />
						</View>
						<Text className="my-1.5 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
							₹{cashAmount.toLocaleString("en-IN")}
						</Text>
					</View>

					{/* UPI */}
					<View className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-semibold text-slate-800 text-sm dark:text-zinc-200">
								UPI
							</Text>
							<UpiBadgeIcon size={18} />
						</View>
						<Text className="my-1.5 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
							₹{upiAmount.toLocaleString("en-IN")}
						</Text>
					</View>
				</View>

				{/* QUICK ACTIONS SECTION (Matches reference design) */}
				<View className="mb-4">
					<Text className="mb-2.5 font-bold text-[#0f274a] text-base dark:text-white">
						Quick Actions
					</Text>

					<View className="mb-2.5 flex-row gap-3">
						{/* Add Bill */}
						<Pressable
							onPress={() => setCreateBillModalVisible(true)}
							className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-sky-100/80 bg-[#f0f7ff] p-3 shadow-xs active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<AddBillIcon />
							<Text className="font-bold text-[#0f274a] text-sm dark:text-white">
								Add Bill
							</Text>
						</Pressable>

						{/* Add Stock */}
						<Pressable
							onPress={() => router.push("/(drawer)/(tabs)/stock/entry" as any)}
							className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-sky-100/80 bg-[#f0f7ff] p-3 shadow-xs active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<AddStockIcon />
							<Text className="font-bold text-[#0f274a] text-sm dark:text-white">
								Add Stock
							</Text>
						</Pressable>
					</View>

					<View className="flex-row gap-3">
						{/* Stock Report */}
						<Pressable
							onPress={() =>
								router.push("/(drawer)/(tabs)/stock/history" as any)
							}
							className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-sky-100/80 bg-[#f0f7ff] p-3 shadow-xs active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<StockReportIcon />
							<Text className="font-bold text-[#0f274a] text-sm dark:text-white">
								Stock Report
							</Text>
						</Pressable>

						{/* Sales Report */}
						<Pressable
							onPress={() => router.push("/(drawer)/(tabs)/reports" as any)}
							className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-sky-100/80 bg-[#f0f7ff] p-3 shadow-xs active:opacity-80 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<SalesReportIcon />
							<Text className="font-bold text-[#0f274a] text-sm dark:text-white">
								Sales Report
							</Text>
						</Pressable>
					</View>
				</View>

				{/* LOW STOCK ALERTS CARD */}
				<View className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					{/* Card Header */}
					<View className="flex-row items-center justify-between pb-3">
						<View className="flex-row items-center">
							<Ionicons name="warning" size={18} color="#f97316" />
							<Text className="ml-2 font-bold text-base text-slate-900 dark:text-white">
								Low Stock Alerts
							</Text>
						</View>
						<Pressable onPress={() => router.push("/stock" as any)} hitSlop={8}>
							<Text className="font-semibold text-[#0284c7] text-sm dark:text-[#38bdf8]">
								View All
							</Text>
						</Pressable>
					</View>

					{/* Items List */}
					<View>
						{isProductsLoading ? (
							<View className="items-center py-4">
								<ActivityIndicator size="small" color="#f97316" />
							</View>
						) : lowStockAlerts.length === 0 ? (
							<View className="items-center py-4">
								<Ionicons
									name="checkmark-circle-outline"
									size={24}
									color="#10b981"
								/>
								<Text className="mt-1 text-slate-500 text-xs dark:text-zinc-400">
									All inventory stock levels are healthy
								</Text>
							</View>
						) : (
							lowStockAlerts.map((item, index) => (
								<View key={item.id}>
									{index > 0 && (
										<View className="h-px bg-slate-100 dark:bg-zinc-800" />
									)}
									<Pressable
										onPress={() => router.push("/stock" as any)}
										className="flex-row items-center justify-between py-3 active:opacity-75"
									>
										<Text className="flex-1 pr-2 font-medium text-slate-800 text-sm dark:text-zinc-200">
											{item.name}
										</Text>
										<Text
											className={`font-bold text-sm ${
												item.isCritical
													? "text-red-500 dark:text-red-400"
													: "text-[#f97316] dark:text-orange-400"
											}`}
										>
											{item.quantity}
										</Text>
									</Pressable>
								</View>
							))
						)}
					</View>
				</View>

				{/* RECENT BILLS CARD */}
				<View className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					{/* Card Header */}
					<View className="flex-row items-center justify-between pb-3">
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							Recent Bills
						</Text>
						<Pressable
							onPress={() => router.push("/billing" as any)}
							hitSlop={8}
						>
							<Text className="font-semibold text-[#0284c7] text-sm dark:text-[#38bdf8]">
								View All
							</Text>
						</Pressable>
					</View>

					{/* Bills List */}
					<View>
						{isSalesLoading ? (
							<View className="items-center py-4">
								<ActivityIndicator size="small" color="#0ea5e9" />
							</View>
						) : recentBills.length === 0 ? (
							<View className="items-center py-4">
								<Ionicons
									name="document-text-outline"
									size={24}
									color="#94a3b8"
								/>
								<Text className="mt-1 text-slate-500 text-xs dark:text-zinc-400">
									No bills created yet today
								</Text>
							</View>
						) : (
							recentBills.map((bill, index) => (
								<View key={bill.id}>
									{index > 0 && (
										<View className="h-px bg-slate-100 dark:bg-zinc-800" />
									)}
									<Pressable
										onPress={() => router.push("/billing" as any)}
										className="flex-row items-center justify-between py-3 active:opacity-75"
									>
										{/* Bill Number */}
										<Text className="flex-1 font-semibold text-slate-800 text-sm dark:text-zinc-200">
											{bill.billNo}
										</Text>

										{/* Bill Amount */}
										<Text className="flex-1 text-center font-bold text-slate-900 text-sm dark:text-white">
											{bill.amount}
										</Text>

										{/* Time & Chevron */}
										<View className="flex-row items-center justify-end">
											<Text className="mr-1.5 text-slate-400 text-xs dark:text-zinc-500">
												{bill.time}
											</Text>
											<Ionicons
												name="chevron-forward"
												size={14}
												color="#94a3b8"
											/>
										</View>
									</Pressable>
								</View>
							))
						)}
					</View>
				</View>
			</ScrollView>

			{/* CREATE BILL DIALOG MODAL */}
			<DialogModal
				visible={createBillModalVisible}
				onClose={() => setCreateBillModalVisible(false)}
				title="Create New Bill"
				subtitle="Generate quick bill and record payment"
				footer={
					<View className="flex-row gap-3">
						<Pressable
							className="flex-1 items-center justify-center rounded-xl border border-slate-200 py-3 dark:border-zinc-800"
							onPress={() => setCreateBillModalVisible(false)}
							disabled={isSubmittingBill}
						>
							<Text className="font-semibold text-slate-700 dark:text-zinc-300">
								Cancel
							</Text>
						</Pressable>
						<Pressable
							className="flex-1 items-center justify-center rounded-xl bg-accent py-3 active:opacity-90"
							onPress={handleCreateBill}
							disabled={isSubmittingBill}
						>
							{isSubmittingBill ? (
								<ActivityIndicator size="small" color="#ffffff" />
							) : (
								<Text className="font-bold text-accent-foreground">
									Create Bill
								</Text>
							)}
						</Pressable>
					</View>
				}
			>
				<View className="gap-4">
					{/* Bill Amount */}
					<View>
						<Text className="mb-1 font-semibold text-slate-800 text-sm dark:text-zinc-200">
							Bill Amount (₹) *
						</Text>
						<Input
							placeholder="Enter amount (e.g. 1250)"
							value={billAmount}
							onChangeText={setBillAmount}
							keyboardType="numeric"
						/>
					</View>

					{/* Payment Method */}
					<View>
						<Text className="mb-1.5 font-semibold text-slate-800 text-sm dark:text-zinc-200">
							Payment Method
						</Text>
						<View className="flex-row gap-3">
							<Pressable
								onPress={() => setPaymentMethod("CASH")}
								className={`flex-1 flex-row items-center justify-center rounded-xl border p-3 ${
									paymentMethod === "CASH"
										? "border-accent bg-accent/10"
										: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<Ionicons
									name="cash-outline"
									size={18}
									color={paymentMethod === "CASH" ? themeAccent : "#64748b"}
								/>
								<Text
									className={`ml-2 font-semibold text-sm ${
										paymentMethod === "CASH"
											? "text-accent"
											: "text-slate-700 dark:text-zinc-300"
									}`}
								>
									Cash
								</Text>
							</Pressable>

							<Pressable
								onPress={() => setPaymentMethod("UPI")}
								className={`flex-1 flex-row items-center justify-center rounded-xl border p-3 ${
									paymentMethod === "UPI"
										? "border-[#0d9488] bg-[#0d9488]/10"
										: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<Ionicons
									name="flash-outline"
									size={18}
									color={paymentMethod === "UPI" ? "#0d9488" : "#64748b"}
								/>
								<Text
									className={`ml-2 font-semibold text-sm ${
										paymentMethod === "UPI"
											? "text-[#0d9488]"
											: "text-slate-700 dark:text-zinc-300"
									}`}
								>
									UPI
								</Text>
							</Pressable>
						</View>
					</View>

					{/* Customer Selection */}
					<View>
						<Text className="mb-1.5 font-semibold text-slate-800 text-sm dark:text-zinc-200">
							Customer
						</Text>
						{customersResponse?.data && customersResponse.data.length > 0 ? (
							<ScrollView horizontal showsHorizontalScrollIndicator={false}>
								<View className="flex-row gap-2">
									<Pressable
										onPress={() => setSelectedCustomerId("")}
										className={`rounded-lg border px-3 py-1.5 ${
											!selectedCustomerId
												? "border-accent bg-accent/10"
												: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
										}`}
									>
										<Text
											className={`font-semibold text-xs ${
												!selectedCustomerId
													? "text-accent"
													: "text-slate-700 dark:text-zinc-300"
											}`}
										>
											Counter / Walk-in
										</Text>
									</Pressable>
									{customersResponse.data.slice(0, 5).map((cust) => (
										<Pressable
											key={cust._id}
											onPress={() => setSelectedCustomerId(cust._id)}
											className={`rounded-lg border px-3 py-1.5 ${
												selectedCustomerId === cust._id
													? "border-accent bg-accent/10"
													: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
											}`}
										>
											<Text
												className={`font-semibold text-xs ${
													selectedCustomerId === cust._id
														? "text-accent"
														: "text-slate-700 dark:text-zinc-300"
												}`}
											>
												{cust.name}
											</Text>
										</Pressable>
									))}
								</View>
							</ScrollView>
						) : (
							<Text className="text-slate-500 text-xs dark:text-zinc-400">
								Walk-in Counter Customer
							</Text>
						)}
					</View>
				</View>
			</DialogModal>
		</Container>
	);
}
