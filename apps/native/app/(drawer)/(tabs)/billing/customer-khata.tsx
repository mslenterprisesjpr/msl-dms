import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	Share,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { useCustomerLedger } from "@/hooks/queries/use-customers";
import { useCreatePayment } from "@/hooks/queries/use-payments";
import { authClient } from "@/lib/auth-client";
import type { CustomerLedgerTransaction } from "@/types/customer";

export default function CustomerKhataScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");

	const { id } = useLocalSearchParams<{ id: string }>();
	const { data: session } = authClient.useSession();
	const currentUserId = session?.user?.id || "";

	// Fetch Customer Ledger
	const {
		data: ledgerResponse,
		isLoading,
		refetch,
	} = useCustomerLedger(id || "");

	const createPaymentMutation = useCreatePayment();

	const [refreshing, setRefreshing] = useState(false);
	const [activeFilter, setActiveFilter] = useState<
		"ALL" | "INVOICES" | "PAYMENTS" | "UNPAID"
	>("ALL");
	const [searchQuery, setSearchQuery] = useState("");

	// Payment Collection Modal State
	const [paymentModalVisible, setPaymentModalVisible] = useState(false);
	const [selectedSaleId, setSelectedSaleId] = useState("");
	const [paymentAmount, setPaymentAmount] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD">(
		"CASH",
	);
	const [paymentNote, setPaymentNote] = useState("");

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	const customer = ledgerResponse?.customer;
	const summary = ledgerResponse?.summary;
	const timeline = ledgerResponse?.timeline || [];
	const unpaidInvoices = ledgerResponse?.unpaidInvoices || [];

	// Filtered Ledger Events
	const filteredTimeline = useMemo(() => {
		let list = timeline;

		if (activeFilter === "INVOICES") {
			list = list.filter((t) => t.type === "INVOICE");
		} else if (activeFilter === "PAYMENTS") {
			list = list.filter((t) => t.type === "PAYMENT");
		} else if (activeFilter === "UNPAID") {
			list = list.filter(
				(t) =>
					t.type === "INVOICE" &&
					(t.status === "PENDING" || t.status === "PARTIAL"),
			);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(t) =>
					t.title.toLowerCase().includes(q) ||
					t.referenceNo.toLowerCase().includes(q) ||
					t.note?.toLowerCase().includes(q),
			);
		}

		return list;
	}, [timeline, activeFilter, searchQuery]);

	// Open Payment modal for specific unpaid bill or general
	const handleOpenPayment = (saleId?: string, defaultAmount?: number) => {
		if (unpaidInvoices.length === 0) {
			toast.show({
				variant: "success",
				label: "Customer has no pending balance!",
			});
			return;
		}

		const targetSaleId = saleId || unpaidInvoices[0]?._id || "";
		setSelectedSaleId(targetSaleId);

		const targetInvoice = unpaidInvoices.find((s) => s._id === targetSaleId);
		const amountToPay =
			defaultAmount !== undefined
				? defaultAmount
				: targetInvoice?.pendingAmount || summary?.totalPending || 0;

		setPaymentAmount(amountToPay > 0 ? amountToPay.toString() : "");
		setPaymentMethod("CASH");
		setPaymentNote("");
		setPaymentModalVisible(true);
	};

	// Submit Payment
	const handleSubmitPayment = async () => {
		if (!selectedSaleId) {
			toast.show({
				variant: "danger",
				label: "Please select an invoice to apply payment",
			});
			return;
		}

		const amountNum = Number.parseFloat(paymentAmount);
		if (!amountNum || amountNum <= 0) {
			toast.show({
				variant: "danger",
				label: "Please enter a valid payment amount",
			});
			return;
		}

		const targetInvoice = unpaidInvoices.find((s) => s._id === selectedSaleId);
		const maxAllowed = targetInvoice?.pendingAmount || 0;

		if (amountNum > maxAllowed) {
			toast.show({
				variant: "danger",
				label: `Amount exceeds bill pending balance of ₹${maxAllowed.toLocaleString("en-IN")}`,
			});
			return;
		}

		try {
			await createPaymentMutation.mutateAsync({
				saleId: selectedSaleId,
				amount: amountNum,
				paymentMethod,
				paymentDate: new Date().toISOString(),
				note: paymentNote.trim() || undefined,
				createdBy: currentUserId,
			});

			toast.show({
				variant: "success",
				label: `Payment of ₹${amountNum.toLocaleString("en-IN")} recorded successfully!`,
			});

			setPaymentModalVisible(false);
			await refetch();
		} catch (error: any) {
			console.error("Payment error:", error);
			Alert.alert(
				"Payment Failed",
				error?.response?.data?.message || "Failed to record payment",
			);
		}
	};

	// Share Statement via WhatsApp or Clipboard
	const handleShareStatement = async () => {
		if (!customer) return;

		const statementText =
			`*KHATA STATEMENT - ${customer.name.toUpperCase()}*\n` +
			`Date: ${new Date().toLocaleDateString("en-IN")}\n` +
			`Phone: ${customer.phone || "N/A"}\n\n` +
			"📊 *SUMMARY:*\n" +
			`• Total Billed: ₹${(summary?.totalBilled || 0).toLocaleString("en-IN")}\n` +
			`• Total Payments Received: ₹${(summary?.totalPaid || 0).toLocaleString("en-IN")}\n` +
			`• *CURRENT OUTSTANDING DUE: ₹${(summary?.totalPending || 0).toLocaleString("en-IN")}*\n\n` +
			"Recent Transactions (Last 5):\n" +
			timeline
				.slice(0, 5)
				.map(
					(t) =>
						`• ${new Date(t.date).toLocaleDateString("en-IN")}: ${t.type === "INVOICE" ? `Bill #${t.referenceNo}` : `Payment (${t.paymentMethod})`} - ₹${t.debit > 0 ? t.debit : t.credit} (Bal: ₹${t.runningBalance})`,
				)
				.join("\n") +
			"\n\nGenerated by MSL Distribution Management";

		try {
			await Share.share({
				message: statementText,
				title: `Khata Statement - ${customer.name}`,
			});
		} catch (error) {
			console.error("Share error:", error);
		}
	};

	if (isLoading) {
		return (
			<Container
				isScrollable={false}
				className="flex-1 items-center justify-center bg-slate-50 dark:bg-zinc-950"
			>
				<ActivityIndicator size="large" color={themeAccent || "#0284c7"} />
				<Text className="mt-3 font-semibold text-slate-500 text-xs dark:text-zinc-400">
					Loading Customer Khata & Ledger...
				</Text>
			</Container>
		);
	}

	if (!customer) {
		return (
			<Container
				isScrollable={false}
				className="flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-zinc-950"
			>
				<Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
				<Text className="mt-3 font-bold text-base text-slate-800 dark:text-white">
					Customer Not Found
				</Text>
				<Pressable
					onPress={() => router.back()}
					className="mt-4 rounded-xl bg-slate-200 px-4 py-2 dark:bg-zinc-800"
				>
					<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-200">
						Go Back
					</Text>
				</Pressable>
			</Container>
		);
	}

	const isPendingClear = (summary?.totalPending || 0) <= 0;

	return (
		<Container
			isScrollable={false}
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
		>
			{/* Top Bar with Customer Name & Actions */}
			<View className="flex-row items-center justify-between border-slate-200 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
				<View className="flex-row items-center gap-2.5">
					<Pressable
						onPress={() => router.back()}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons
							name="arrow-back"
							size={18}
							color={themeColorForeground}
						/>
					</Pressable>
					<View>
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							Customer Khata (Ledger)
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							Complete billing & payment reconciliation
						</Text>
					</View>
				</View>

				{/* Fast Actions */}
				<View className="flex-row items-center gap-2">
					<Pressable
						onPress={handleShareStatement}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons name="share-social-outline" size={16} color="#0284c7" />
					</Pressable>
					<Pressable
						onPress={onRefresh}
						disabled={refreshing}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons
							name={refreshing ? "sync" : "refresh-outline"}
							size={16}
							color={themeAccent || "#0284c7"}
						/>
					</Pressable>
				</View>
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={[themeAccent || "#0284c7"]}
						tintColor={themeAccent || "#0284c7"}
					/>
				}
			>
				{/* 1. CUSTOMER IDENTITY CARD */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center justify-between">
						<View className="flex-1 flex-row items-center gap-3">
							<View className="h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 dark:bg-sky-500/20">
								<Ionicons name="storefront" size={24} color="#0284c7" />
							</View>
							<View className="flex-1">
								<View className="flex-row items-center gap-2">
									<Text className="font-black text-lg text-slate-900 tracking-tight dark:text-white">
										{customer.name}
									</Text>
									<View
										className={`rounded-md px-1.5 py-0.5 ${
											customer.isActive
												? "bg-emerald-100 dark:bg-emerald-950/40"
												: "bg-slate-100 dark:bg-zinc-800"
										}`}
									>
										<Text
											className={`font-bold text-[10px] ${
												customer.isActive
													? "text-emerald-700 dark:text-emerald-300"
													: "text-slate-500"
											}`}
										>
											{customer.isActive ? "ACTIVE" : "INACTIVE"}
										</Text>
									</View>
								</View>
								<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
									{customer.address || "No address specified"}
								</Text>
							</View>
						</View>

						{/* Phone Call / WhatsApp */}
						{customer.phone && (
							<View className="flex-row items-center gap-1.5">
								<Pressable
									onPress={() => Linking.openURL(`tel:${customer.phone}`)}
									className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 active:opacity-75 dark:bg-emerald-950/40"
								>
									<Ionicons name="call" size={16} color="#10b981" />
								</Pressable>
								<Pressable
									onPress={() =>
										Linking.openURL(
											`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`,
										)
									}
									className="h-9 w-9 items-center justify-center rounded-xl bg-green-50 active:opacity-75 dark:bg-green-950/40"
								>
									<Ionicons name="logo-whatsapp" size={16} color="#22c55e" />
								</Pressable>
							</View>
						)}
					</View>

					{/* Metadata row */}
					<View className="mt-3 flex-row items-center gap-3 border-slate-100 border-t pt-3 dark:border-zinc-800/80">
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							📞 {customer.phone || "No phone"}
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							•
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							Tax ID: {customer.gstNumber || "Unregistered"}
						</Text>
					</View>
				</Card>

				{/* 2. EXECUTIVE FINANCIAL LEDGER KPI SUMMARY */}
				<View className="mb-4">
					{/* HERO PENDING BALANCE CARD */}
					<View
						className={`mb-3 rounded-3xl border p-4 shadow-sm ${
							isPendingClear
								? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-950/60 dark:bg-emerald-950/30"
								: "border-rose-200 bg-rose-50/70 dark:border-rose-950/60 dark:bg-rose-950/30"
						}`}
					>
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center gap-1.5">
								<Ionicons
									name={isPendingClear ? "shield-checkmark" : "warning"}
									size={16}
									color={isPendingClear ? "#059669" : "#e11d48"}
								/>
								<Text
									className={`font-bold text-xs uppercase tracking-wider ${
										isPendingClear
											? "text-emerald-800 dark:text-emerald-300"
											: "text-rose-800 dark:text-rose-300"
									}`}
								>
									Current Outstanding Balance (Due)
								</Text>
							</View>

							<View
								className={`rounded-full px-2.5 py-0.5 ${
									isPendingClear
										? "bg-emerald-200/80 dark:bg-emerald-900/60"
										: "bg-rose-200/80 dark:bg-rose-900/60"
								}`}
							>
								<Text
									className={`font-black text-[10px] ${
										isPendingClear
											? "text-emerald-800 dark:text-emerald-200"
											: "text-rose-800 dark:text-rose-200"
									}`}
								>
									{isPendingClear ? "ALL CLEAR" : "PAYMENT DUE"}
								</Text>
							</View>
						</View>

						<Text
							className={`my-1 font-black text-3xl tracking-tight ${
								isPendingClear
									? "text-emerald-900 dark:text-emerald-100"
									: "text-rose-950 dark:text-rose-100"
							}`}
						>
							₹{(summary?.totalPending || 0).toLocaleString("en-IN")}
						</Text>

						<View className="flex-row items-center justify-between">
							<Text
								className={`font-medium text-xs ${
									isPendingClear
										? "text-emerald-700/80 dark:text-emerald-300/80"
										: "text-rose-700/80 dark:text-rose-300/80"
								}`}
							>
								{isPendingClear
									? "Customer has settled all invoices"
									: `${summary?.unpaidBillsCount || 0} unpaid / partial invoice(s)`}
							</Text>

							{!isPendingClear && (
								<Pressable
									onPress={() => handleOpenPayment()}
									className="rounded-xl bg-rose-600 px-3 py-1.5 shadow-xs active:opacity-90"
								>
									<Text className="font-bold text-white text-xs">
										Collect Payment
									</Text>
								</Pressable>
							)}
						</View>
					</View>

					{/* 2-COLUMN METRICS: TOTAL BILLED & TOTAL PAID */}
					<View className="flex-row gap-3">
						{/* Total Billed */}
						<View className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center gap-1.5">
								<Ionicons name="receipt-outline" size={15} color="#64748b" />
								<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
									Total Billed
								</Text>
							</View>
							<Text className="my-1 font-black text-slate-900 text-xl tracking-tight dark:text-white">
								₹{(summary?.totalBilled || 0).toLocaleString("en-IN")}
							</Text>
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								{summary?.totalBillsCount || 0} invoices created
							</Text>
						</View>

						{/* Total Received */}
						<View className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
							<View className="flex-row items-center gap-1.5">
								<Ionicons
									name="checkmark-done-circle-outline"
									size={15}
									color="#10b981"
								/>
								<Text className="font-semibold text-emerald-700 text-xs dark:text-emerald-400">
									Total Received
								</Text>
							</View>
							<Text className="my-1 font-black text-emerald-600 text-xl tracking-tight dark:text-emerald-400">
								₹{(summary?.totalPaid || 0).toLocaleString("en-IN")}
							</Text>
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								cleared in accounts
							</Text>
						</View>
					</View>
				</View>

				{/* 3. QUICK ACTION BAR */}
				<View className="mb-4 flex-row gap-2.5">
					<Pressable
						onPress={() => handleOpenPayment()}
						disabled={isPendingClear}
						className={`flex-1 flex-row items-center justify-center rounded-2xl py-3 shadow-xs active:opacity-90 ${
							isPendingClear
								? "bg-slate-200 dark:bg-zinc-800"
								: "bg-emerald-600"
						}`}
					>
						<Ionicons
							name="cash-outline"
							size={18}
							color={isPendingClear ? "#94a3b8" : "#ffffff"}
							style={{ marginRight: 6 }}
						/>
						<Text
							className={`font-bold text-xs ${
								isPendingClear
									? "text-slate-400 dark:text-zinc-500"
									: "text-white"
							}`}
						>
							Record Payment
						</Text>
					</Pressable>

					<Pressable
						onPress={() =>
							router.push({
								pathname: "/billing/create" as any,
								params: { customerId: customer._id },
							})
						}
						className="flex-1 flex-row items-center justify-center rounded-2xl bg-sky-600 py-3 shadow-xs active:opacity-90"
					>
						<Ionicons
							name="document-text-outline"
							size={18}
							color="#ffffff"
							style={{ marginRight: 6 }}
						/>
						<Text className="font-bold text-white text-xs">
							+ Create New Bill
						</Text>
					</Pressable>
				</View>

				{/* 4. LEDGER TIMELINE HEADER & FILTER PILLS */}
				<View className="mb-3">
					<View className="mb-2 flex-row items-center justify-between">
						<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
							Khata Timeline ({filteredTimeline.length})
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							Running Balance Format
						</Text>
					</View>

					{/* Search in Timeline */}
					<View className="mb-2 flex-row items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
						<Ionicons
							name="search"
							size={14}
							color="#94a3b8"
							style={{ marginRight: 6 }}
						/>
						<TextInput
							placeholder="Search by Bill #, Payment, Note..."
							placeholderTextColor="#94a3b8"
							value={searchQuery}
							onChangeText={setSearchQuery}
							className="flex-1 font-medium text-slate-900 text-xs dark:text-white"
						/>
						{searchQuery.length > 0 && (
							<Pressable onPress={() => setSearchQuery("")}>
								<Ionicons name="close-circle" size={14} color="#94a3b8" />
							</Pressable>
						)}
					</View>

					{/* Filter Chips */}
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						className="flex-row gap-2"
					>
						<Pressable
							onPress={() => setActiveFilter("ALL")}
							className={`rounded-xl px-3.5 py-1.5 ${
								activeFilter === "ALL"
									? "bg-slate-900 dark:bg-white"
									: "border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							}`}
						>
							<Text
								className={`font-bold text-xs ${
									activeFilter === "ALL"
										? "text-white dark:text-slate-900"
										: "text-slate-600 dark:text-zinc-400"
								}`}
							>
								All ({timeline.length})
							</Text>
						</Pressable>

						<Pressable
							onPress={() => setActiveFilter("INVOICES")}
							className={`rounded-xl px-3.5 py-1.5 ${
								activeFilter === "INVOICES"
									? "bg-slate-900 dark:bg-white"
									: "border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							}`}
						>
							<Text
								className={`font-bold text-xs ${
									activeFilter === "INVOICES"
										? "text-white dark:text-slate-900"
										: "text-slate-600 dark:text-zinc-400"
								}`}
							>
								Bills ({summary?.totalBillsCount || 0})
							</Text>
						</Pressable>

						<Pressable
							onPress={() => setActiveFilter("PAYMENTS")}
							className={`rounded-xl px-3.5 py-1.5 ${
								activeFilter === "PAYMENTS"
									? "bg-slate-900 dark:bg-white"
									: "border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							}`}
						>
							<Text
								className={`font-bold text-xs ${
									activeFilter === "PAYMENTS"
										? "text-white dark:text-slate-900"
										: "text-slate-600 dark:text-zinc-400"
								}`}
							>
								Payments
							</Text>
						</Pressable>

						<Pressable
							onPress={() => setActiveFilter("UNPAID")}
							className={`rounded-xl px-3.5 py-1.5 ${
								activeFilter === "UNPAID"
									? "bg-rose-600"
									: "border border-rose-200 bg-rose-50/50 dark:border-rose-950/60 dark:bg-rose-950/20"
							}`}
						>
							<Text
								className={`font-bold text-xs ${
									activeFilter === "UNPAID"
										? "text-white"
										: "text-rose-700 dark:text-rose-300"
								}`}
							>
								Unpaid ({summary?.unpaidBillsCount || 0})
							</Text>
						</Pressable>
					</ScrollView>
				</View>

				{/* 5. TRANSACTION TIMELINE ENTRIES */}
				{filteredTimeline.length === 0 ? (
					<Card className="items-center justify-center border-slate-200 border-dashed bg-white py-12 dark:border-zinc-800 dark:bg-zinc-900">
						<View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
							<Ionicons name="receipt-outline" size={24} color="#94a3b8" />
						</View>
						<Text className="font-bold text-base text-slate-800 dark:text-zinc-200">
							No Ledger Records Found
						</Text>
						<Text className="mt-1 text-center font-medium text-slate-400 text-xs">
							{searchQuery
								? `No transactions match "${searchQuery}"`
								: "No billing or payment records exist for this customer yet."}
						</Text>
					</Card>
				) : (
					<View className="gap-2.5">
						{filteredTimeline.map((item) => {
							const isInvoice = item.type === "INVOICE";
							const isPaid = item.status === "PAID";
							const isPending =
								item.status === "PENDING" || item.status === "PARTIAL";

							return (
								<Card
									key={item.id}
									className={`border p-3.5 shadow-xs ${
										isInvoice
											? isPending
												? "border-rose-200/80 bg-white dark:border-rose-950/60 dark:bg-zinc-900"
												: "border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
											: "border-emerald-200/70 bg-emerald-50/20 dark:border-emerald-950/60 dark:bg-zinc-900"
									}`}
								>
									<View className="flex-row items-center justify-between">
										{/* Left Icon & Details */}
										<View className="flex-1 flex-row items-center gap-3 pr-2">
											<View
												className={`h-10 w-10 items-center justify-center rounded-2xl ${
													isInvoice
														? isPending
															? "bg-rose-500/15"
															: "bg-slate-500/10 dark:bg-zinc-800"
														: "bg-emerald-500/15"
												}`}
											>
												<Ionicons
													name={
														isInvoice ? "document-text" : "checkmark-circle"
													}
													size={20}
													color={
														isInvoice
															? isPending
																? "#e11d48"
																: "#64748b"
															: "#10b981"
													}
												/>
											</View>

											<View className="flex-1">
												<View className="flex-row items-center gap-2">
													<Text className="font-bold text-slate-900 text-sm dark:text-white">
														{item.title}
													</Text>

													{/* Status badge */}
													{isInvoice && (
														<View
															className={`rounded-md px-1.5 py-0.5 ${
																isPaid
																	? "bg-emerald-100 dark:bg-emerald-950/40"
																	: item.status === "PARTIAL"
																		? "bg-amber-100 dark:bg-amber-950/40"
																		: "bg-rose-100 dark:bg-rose-950/40"
															}`}
														>
															<Text
																className={`font-bold text-[9px] ${
																	isPaid
																		? "text-emerald-700 dark:text-emerald-300"
																		: item.status === "PARTIAL"
																			? "text-amber-700 dark:text-amber-300"
																			: "text-rose-700 dark:text-rose-300"
																}`}
															>
																{item.status}
															</Text>
														</View>
													)}
												</View>

												<Text className="mt-0.5 font-medium text-[11px] text-slate-400 dark:text-zinc-500">
													{new Date(item.date).toLocaleDateString([], {
														day: "numeric",
														month: "short",
														year: "numeric",
														hour: "2-digit",
														minute: "2-digit",
													})}
													{item.note ? ` • ${item.note}` : ""}
												</Text>
											</View>
										</View>

										{/* Right Column: Debit/Credit and Running Balance */}
										<View className="items-end">
											<Text
												className={`font-black text-base ${
													isInvoice
														? "text-rose-600 dark:text-rose-400"
														: "text-emerald-600 dark:text-emerald-400"
												}`}
											>
												{isInvoice
													? `+ ₹${item.debit.toLocaleString("en-IN")}`
													: `- ₹${item.credit.toLocaleString("en-IN")}`}
											</Text>

											{/* Running Balance Pill */}
											<View className="mt-1 rounded-md bg-slate-100 px-2 py-0.5 dark:bg-zinc-800">
												<Text className="font-bold text-[10px] text-slate-700 dark:text-zinc-300">
													Bal: ₹{item.runningBalance.toLocaleString("en-IN")}
												</Text>
											</View>
										</View>
									</View>

									{/* Bottom Action for Unpaid Bill */}
									{isInvoice && isPending && (
										<View className="mt-2.5 flex-row items-center justify-between border-slate-100 border-t pt-2 dark:border-zinc-800/60">
											<Text className="font-semibold text-rose-600 text-xs dark:text-rose-400">
												Pending: ₹
												{(item.pendingAmount || 0).toLocaleString("en-IN")}
											</Text>
											<Pressable
												onPress={() =>
													handleOpenPayment(item.id, item.pendingAmount)
												}
												className="rounded-lg bg-rose-50 px-2.5 py-1 active:opacity-75 dark:bg-rose-950/40"
											>
												<Text className="font-bold text-[11px] text-rose-700 dark:text-rose-300">
													Settle Bill ➔
												</Text>
											</Pressable>
										</View>
									)}
								</Card>
							);
						})}
					</View>
				)}
			</ScrollView>

			{/* ================= MODAL: RECORD PAYMENT ================= */}
			<Modal
				visible={paymentModalVisible}
				transparent
				animationType="slide"
				onRequestClose={() => setPaymentModalVisible(false)}
			>
				<View className="flex-1 justify-end bg-black/60">
					<View className="rounded-t-3xl bg-white p-5 dark:bg-zinc-900">
						{/* Modal Header */}
						<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
							<View>
								<Text className="font-bold text-lg text-slate-900 dark:text-white">
									Record Customer Payment
								</Text>
								<Text className="font-medium text-slate-400 text-xs dark:text-zinc-500">
									Customer: {customer.name}
								</Text>
							</View>
							<Pressable
								onPress={() => setPaymentModalVisible(false)}
								className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
							>
								<Ionicons name="close" size={18} color={themeColorForeground} />
							</Pressable>
						</View>

						<ScrollView
							className="max-h-[440px] py-3"
							showsVerticalScrollIndicator={false}
						>
							{/* Select Unpaid Bill */}
							<View className="mb-4">
								<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
									Apply to Unpaid Invoice *
								</Text>
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									className="flex-row gap-2"
								>
									{unpaidInvoices.map((inv) => {
										const isSelected = selectedSaleId === inv._id;
										return (
											<Pressable
												key={inv._id}
												onPress={() => {
													setSelectedSaleId(inv._id);
													setPaymentAmount(inv.pendingAmount.toString());
												}}
												className={`rounded-2xl border p-3 ${
													isSelected
														? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
														: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-800"
												}`}
											>
												<Text className="font-bold text-slate-800 text-xs dark:text-white">
													Bill #{inv.invoiceNo}
												</Text>
												<Text className="mt-0.5 font-black text-rose-600 text-sm dark:text-rose-400">
													Due: ₹
													{(inv.pendingAmount || 0).toLocaleString("en-IN")}
												</Text>
												<Text className="font-medium text-[10px] text-slate-400">
													Total: ₹{(inv.total || 0).toLocaleString("en-IN")}
												</Text>
											</Pressable>
										);
									})}
								</ScrollView>
							</View>

							{/* Amount to Pay */}
							<View className="mb-4">
								<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
									Amount Received (₹) *
								</Text>
								<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800">
									<Text className="mr-1 font-bold text-base text-slate-500">
										₹
									</Text>
									<TextInput
										keyboardType="numeric"
										value={paymentAmount}
										onChangeText={setPaymentAmount}
										placeholder="0"
										placeholderTextColor="#94a3b8"
										className="flex-1 font-bold text-lg text-slate-900 dark:text-white"
									/>
								</View>
							</View>

							{/* Payment Method Selector */}
							<View className="mb-4">
								<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
									Payment Method *
								</Text>
								<View className="flex-row gap-2">
									{(["CASH", "UPI", "CARD"] as const).map((method) => {
										const isSelected = paymentMethod === method;
										return (
											<Pressable
												key={method}
												onPress={() => setPaymentMethod(method)}
												className={`flex-1 items-center justify-center rounded-xl border py-2.5 ${
													isSelected
														? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
														: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-800"
												}`}
											>
												<Text
													className={`font-bold text-xs ${
														isSelected
															? "text-emerald-700 dark:text-emerald-300"
															: "text-slate-600 dark:text-zinc-400"
													}`}
												>
													{method === "CASH"
														? "💵 Cash"
														: method === "UPI"
															? "📱 UPI / QR"
															: "💳 Card"}
												</Text>
											</Pressable>
										);
									})}
								</View>
							</View>

							{/* Payment Note */}
							<View className="mb-2">
								<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
									Note / Reference (Optional)
								</Text>
								<TextInput
									value={paymentNote}
									onChangeText={setPaymentNote}
									placeholder="e.g. GPay ref #, cash received at shop..."
									placeholderTextColor="#94a3b8"
									className="rounded-xl border border-slate-200 bg-white p-2.5 font-medium text-slate-900 text-xs dark:border-zinc-800 dark:bg-zinc-800 dark:text-white"
								/>
							</View>
						</ScrollView>

						{/* Buttons */}
						<View className="flex-row items-center gap-3 border-slate-100 border-t pt-3 dark:border-zinc-800">
							<Pressable
								onPress={() => setPaymentModalVisible(false)}
								className="flex-1 items-center justify-center rounded-2xl border border-slate-200 py-3 active:opacity-80 dark:border-zinc-800"
							>
								<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
									Cancel
								</Text>
							</Pressable>

							<Pressable
								onPress={handleSubmitPayment}
								disabled={createPaymentMutation.isPending}
								className="flex-1 items-center justify-center rounded-2xl bg-emerald-600 py-3 shadow-sm active:opacity-90"
							>
								{createPaymentMutation.isPending ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Text className="font-bold text-white text-xs">
										Confirm & Record Payment
									</Text>
								)}
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</Container>
	);
}
