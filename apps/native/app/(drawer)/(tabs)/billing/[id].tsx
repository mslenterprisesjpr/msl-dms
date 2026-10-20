import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
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
import { HeroBottomSheet } from "@/components/hero-bottom-sheet";
import { useCreatePayment } from "@/hooks/queries/use-payments";
import { useSale } from "@/hooks/queries/use-sales";
import { authClient } from "@/lib/auth-client";
import type { SaleItem } from "@/services/sale.service";

export default function InvoiceDetailScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");

	const { id, openPayment } = useLocalSearchParams<{
		id: string;
		openPayment?: string;
	}>();
	const { data: session } = authClient.useSession();
	const currentUserId = session?.user?.id || "";

	// Fetch Sale Detail
	const { data: sale, isLoading, refetch } = useSale(id || "");
	const createPaymentMutation = useCreatePayment();

	const [refreshing, setRefreshing] = useState(false);

	// Collect Balance Payment Modal
	const [paymentModalVisible, setPaymentModalVisible] = useState(false);
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

	const customer =
		typeof sale?.customerId === "object" ? sale.customerId : null;
	const customerIdStr =
		customer?._id ||
		(typeof sale?.customerId === "string" ? sale.customerId : "");
	const customerName = customer?.name || "Counter Customer";
	const customerPhone = customer?.phone || "";
	const customerAddress = customer?.address || "";
	const customerGst = customer?.gstNumber || "";

	const items: SaleItem[] = sale?.items || [];
	const payments = sale?.payments || [];
	const isPaid = sale?.paymentStatus === "PAID";
	const isPartial = sale?.paymentStatus === "PARTIAL";
	const isPending = sale?.paymentStatus === "PENDING";
	const pendingBalance = sale?.pendingAmount ?? 0;

	// Auto-open payment collection modal if requested via route params
	React.useEffect(() => {
		if (openPayment === "true" && pendingBalance > 0 && !paymentModalVisible) {
			setPaymentAmount(pendingBalance.toString());
			setPaymentMethod("CASH");
			setPaymentNote("");
			setPaymentModalVisible(true);
		}
	}, [openPayment, pendingBalance, paymentModalVisible]);

	// Total Cases & Units across items
	const itemsTotals = useMemo(() => {
		let totalCases = 0;
		let totalUnits = 0;
		items.forEach((item) => {
			totalCases += item.cases || 0;
			totalUnits += item.quantity || 0;
		});
		return { totalCases, totalUnits, totalItems: items.length };
	}, [items]);

	// Open Payment Modal
	const handleOpenPayment = () => {
		if (pendingBalance <= 0) {
			toast.show({
				variant: "success",
				label: "Invoice is already fully paid!",
			});
			return;
		}
		setPaymentAmount(pendingBalance.toString());
		setPaymentMethod("CASH");
		setPaymentNote("");
		setPaymentModalVisible(true);
	};

	// Submit Payment
	const handleSubmitPayment = async () => {
		if (!sale) return;

		const amountNum = Number.parseFloat(paymentAmount);
		if (!amountNum || amountNum <= 0) {
			toast.show({
				variant: "danger",
				label: "Please enter a valid payment amount",
			});
			return;
		}

		if (amountNum > pendingBalance) {
			toast.show({
				variant: "danger",
				label: `Amount exceeds pending balance of ₹${pendingBalance.toLocaleString("en-IN")}`,
			});
			return;
		}

		try {
			await createPaymentMutation.mutateAsync({
				saleId: sale._id,
				amount: amountNum,
				paymentMethod,
				paymentDate: new Date().toISOString(),
				note: paymentNote.trim() || undefined,
				createdBy: currentUserId,
			});

			toast.show({
				variant: "success",
				label: `Payment of ₹${amountNum.toLocaleString("en-IN")} recorded!`,
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

	// Generate Formatted Slip Text
	const generateSlipText = () => {
		if (!sale) return "";

		const dateStr = new Date(
			sale.saleDate || sale.createdAt,
		).toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});

		let text = "🧾 *TAX INVOICE / CASH MEMO*\n";
		text += "*MSL ENTERPRISES*\n";
		text += "--------------------------------\n";
		text += `Invoice No: *#${sale.invoiceNo}*\n`;
		text += `Date: ${dateStr}\n`;
		text += `Party: *${customerName}*\n`;
		if (customerPhone) text += `Phone: ${customerPhone}\n`;
		if (customerGst) text += `GSTIN: ${customerGst}\n`;
		text += "--------------------------------\n";
		text += "*ITEMS BILLED:*\n";

		items.forEach((item, index) => {
			const prodName =
				typeof item.productId === "object"
					? item.productId.name
					: "Product Item";
			const casesText = (item.cases || 0) > 0 ? `${item.cases} cs` : "";
			const looseText = (item.units || 0) > 0 ? `${item.units} pcs` : "";
			const qtyStr =
				casesText && looseText
					? `${casesText} + ${looseText}`
					: casesText || looseText || `${item.quantity} units`;

			text += `${index + 1}. *${prodName}*\n`;
			text += `   Qty: ${qtyStr} @ ₹${item.price} = ₹${item.total.toLocaleString("en-IN")}\n`;
		});

		text += "--------------------------------\n";
		text += `Subtotal: ₹${(sale.subtotal || 0).toLocaleString("en-IN")}\n`;
		if ((sale.discount || 0) > 0) {
			text += `Discount: -₹${sale.discount.toLocaleString("en-IN")}\n`;
		}
		text += `*GRAND TOTAL: ₹${(sale.total || 0).toLocaleString("en-IN")}*\n`;
		text += `Amount Paid: ₹${(sale.paidAmount || 0).toLocaleString("en-IN")}\n`;
		if (pendingBalance > 0) {
			text += `*BALANCE DUE: ₹${pendingBalance.toLocaleString("en-IN")}*\n`;
			text += "Status: ⚠️ PAYMENT PENDING\n";
		} else {
			text += "Status: ✅ FULLY PAID\n";
		}
		text += "--------------------------------\n";
		text += "Thank you for your business! 🙏";

		return text;
	};

	// Share WhatsApp Slip
	const handleWhatsAppShare = async () => {
		const slip = generateSlipText();
		if (!slip) return;

		if (customerPhone) {
			const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
			const phoneWithCountry =
				cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
			const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(slip)}`;

			try {
				const supported = await Linking.canOpenURL(url);
				if (supported) {
					await Linking.openURL(url);
					return;
				}
			} catch (e) {
				console.log(
					"Could not open direct WhatsApp link, falling back to Share:",
					e,
				);
			}
		}

		// Fallback to Native Share sheet
		try {
			await Share.share({
				message: slip,
				title: `Invoice #${sale?.invoiceNo}`,
			});
		} catch (error) {
			console.error("Share error:", error);
		}
	};

	// General Share / Print
	const handleGeneralShare = async () => {
		const slip = generateSlipText();
		if (!slip) return;
		try {
			await Share.share({
				message: slip,
				title: `Bill #${sale?.invoiceNo} - ${customerName}`,
			});
		} catch (error) {
			console.error("General share error:", error);
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
					Loading invoice details & slip...
				</Text>
			</Container>
		);
	}

	if (!sale) {
		return (
			<Container
				isScrollable={false}
				className="flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-zinc-950"
			>
				<Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
				<Text className="mt-3 font-bold text-base text-slate-800 dark:text-white">
					Invoice Not Found
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

	return (
		<Container
			isScrollable={false}
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
		>
			{/* Top Action Bar */}
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
							Invoice #{sale.invoiceNo}
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							{new Date(sale.saleDate || sale.createdAt).toLocaleDateString(
								"en-IN",
								{
									day: "numeric",
									month: "short",
									year: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								},
							)}
						</Text>
					</View>
				</View>

				{/* Header Actions */}
				<View className="flex-row items-center gap-2">
					<Pressable
						onPress={handleGeneralShare}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons name="share-outline" size={17} color="#64748b" />
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
				{/* 1. HERO SLIP HEADER CARD */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
						<View>
							<Text className="font-medium text-[11px] text-slate-400 uppercase tracking-wider dark:text-zinc-500">
								TAX INVOICE / CASH MEMO
							</Text>
							<Text className="font-black text-slate-900 text-xl dark:text-white">
								#{sale.invoiceNo}
							</Text>
						</View>

						{/* Payment Status Pill */}
						<View
							className={`rounded-full px-3 py-1 ${
								isPaid
									? "bg-emerald-100 dark:bg-emerald-950/60"
									: isPartial
										? "bg-amber-100 dark:bg-amber-950/60"
										: "bg-rose-100 dark:bg-rose-950/60"
							}`}
						>
							<Text
								className={`font-black text-xs ${
									isPaid
										? "text-emerald-700 dark:text-emerald-300"
										: isPartial
											? "text-amber-700 dark:text-amber-300"
											: "text-rose-700 dark:text-rose-300"
								}`}
							>
								{isPaid ? "PAID IN FULL" : isPartial ? "PARTIAL DUE" : "UNPAID"}
							</Text>
						</View>
					</View>

					{/* Customer Details */}
					<View className="mt-3 flex-row items-center justify-between">
						<View className="flex-1 pr-2">
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								Billed To:
							</Text>
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								{customerName}
							</Text>
							{customerPhone ? (
								<Text className="mt-0.5 font-medium text-slate-500 text-xs dark:text-zinc-400">
									📞 {customerPhone}
								</Text>
							) : null}
							{customerAddress ? (
								<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
									📍 {customerAddress}
								</Text>
							) : null}
							{customerGst ? (
								<Text className="mt-0.5 font-medium text-[11px] text-slate-400">
									GSTIN: {customerGst}
								</Text>
							) : null}
						</View>

						{/* Quick Customer Action Buttons */}
						<View className="items-end gap-2">
							{customerPhone ? (
								<Pressable
									onPress={() => Linking.openURL(`tel:${customerPhone}`)}
									className="flex-row items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 active:opacity-75 dark:bg-emerald-950/40"
								>
									<Ionicons name="call" size={12} color="#10b981" />
									<Text className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
										Call Party
									</Text>
								</Pressable>
							) : null}

							{customerIdStr ? (
								<Pressable
									onPress={() =>
										router.push({
											pathname: "/billing/customer-khata" as any,
											params: { id: customerIdStr },
										})
									}
									className="flex-row items-center gap-1 rounded-xl bg-sky-50 px-2.5 py-1.5 active:opacity-75 dark:bg-sky-950/40"
								>
									<Ionicons name="book" size={12} color="#0284c7" />
									<Text className="font-bold text-[11px] text-sky-700 dark:text-sky-300">
										View Khata
									</Text>
								</Pressable>
							) : null}
						</View>
					</View>
				</Card>

				{/* 2. PRIMARY WHATSAPP SHARE BANNER */}
				<Pressable
					onPress={handleWhatsAppShare}
					className="mb-4 flex-row items-center justify-between rounded-2xl bg-[#25D366] p-4 shadow-sm active:opacity-90"
				>
					<View className="flex-1 flex-row items-center gap-3">
						<View className="h-10 w-10 items-center justify-center rounded-xl bg-white/20">
							<Ionicons name="logo-whatsapp" size={24} color="#ffffff" />
						</View>
						<View className="flex-1">
							<Text className="font-black text-sm text-white">
								Share WhatsApp Bill Slip
							</Text>
							<Text className="font-medium text-white/90 text-xs">
								{customerPhone
									? `Send instant slip to ${customerPhone}`
									: "Share invoice summary & payment link"}
							</Text>
						</View>
					</View>
					<Ionicons name="send" size={18} color="#ffffff" />
				</Pressable>

				{/* 3. BILLED PRODUCTS LIST (CASES-FIRST) */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="mb-3 flex-row items-center justify-between border-slate-100 border-b pb-2.5 dark:border-zinc-800">
						<Text className="font-bold text-slate-800 text-sm dark:text-white">
							Products Billed ({items.length})
						</Text>
						<View className="rounded-lg bg-sky-50 px-2 py-0.5 dark:bg-sky-950/40">
							<Text className="font-bold text-[11px] text-sky-700 dark:text-sky-300">
								{itemsTotals.totalCases} Cases ({itemsTotals.totalUnits} units)
							</Text>
						</View>
					</View>

					{items.length === 0 ? (
						<Text className="py-4 text-center text-slate-400 text-xs">
							No item records attached to this invoice.
						</Text>
					) : (
						<View className="gap-3">
							{items.map((item, index) => {
								const product =
									typeof item.productId === "object" ? item.productId : null;
								const productName = product?.name || "Product Item";
								const productSku = product?.sku || "";
								const productPack = product?.packSize || "";
								const unitsPerCase = product?.unitsPerCase || 1;
								const cases = item.cases || 0;
								const loose = item.units || 0;

								return (
									<View
										key={item._id || index}
										className="flex-row items-start justify-between border-slate-100 border-b pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800/80"
									>
										{/* Product details */}
										<View className="flex-1 pr-3">
											<Text className="font-bold text-slate-900 text-sm dark:text-white">
												{productName}
											</Text>
											<Text className="mt-0.5 font-medium text-[11px] text-slate-400 dark:text-zinc-500">
												{productSku ? `SKU: ${productSku} • ` : ""}
												{productPack ? `${productPack} • ` : ""}
												{unitsPerCase > 1 ? `${unitsPerCase} pcs/case` : ""}
											</Text>

											{/* Quantity Pill */}
											<View className="mt-1.5 flex-row items-center gap-1.5">
												<View className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-zinc-800">
													<Text className="font-black text-slate-800 text-xs dark:text-zinc-200">
														{cases > 0 ? `${cases} cs` : ""}
														{cases > 0 && loose > 0 ? ` + ${loose} pcs` : ""}
														{cases === 0 ? `${item.quantity} pcs` : ""}
													</Text>
												</View>
												<Text className="font-medium text-[11px] text-slate-400">
													@ ₹{item.price}
												</Text>
											</View>
										</View>

										{/* Total */}
										<View className="items-end">
											<Text className="font-black text-base text-slate-900 dark:text-white">
												₹{item.total.toLocaleString("en-IN")}
											</Text>
											<Text className="font-medium text-[10px] text-slate-400">
												Line Total
											</Text>
										</View>
									</View>
								);
							})}
						</View>
					)}
				</Card>

				{/* 4. FINANCIAL SUMMARY CARD */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Text className="mb-3 font-bold text-slate-800 text-sm dark:text-white">
						Payment & Bill Summary
					</Text>

					<View className="gap-2 border-slate-100 border-b pb-3 dark:border-zinc-800">
						<View className="flex-row items-center justify-between">
							<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
								Subtotal
							</Text>
							<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
								₹{(sale.subtotal || 0).toLocaleString("en-IN")}
							</Text>
						</View>

						{(sale.discount || 0) > 0 && (
							<View className="flex-row items-center justify-between">
								<Text className="font-medium text-emerald-600 text-xs dark:text-emerald-400">
									Special Discount
								</Text>
								<Text className="font-bold text-emerald-600 text-xs dark:text-emerald-400">
									- ₹{sale.discount.toLocaleString("en-IN")}
								</Text>
							</View>
						)}

						<View className="mt-1 flex-row items-center justify-between border-slate-100 border-t pt-2 dark:border-zinc-800">
							<Text className="font-black text-base text-slate-900 dark:text-white">
								Grand Total
							</Text>
							<Text className="font-black text-slate-900 text-xl dark:text-white">
								₹{(sale.total || 0).toLocaleString("en-IN")}
							</Text>
						</View>
					</View>

					{/* Paid vs Due Split */}
					<View className="mt-3 flex-row gap-3">
						<View className="flex-1 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/25">
							<Text className="font-semibold text-emerald-800 text-xs dark:text-emerald-300">
								Amount Paid
							</Text>
							<Text className="my-0.5 font-black text-emerald-700 text-lg dark:text-emerald-400">
								₹{(sale.paidAmount || 0).toLocaleString("en-IN")}
							</Text>
							<Text className="font-medium text-[10px] text-emerald-600/80">
								{payments.length} payment(s)
							</Text>
						</View>

						<View
							className={`flex-1 rounded-2xl p-3 ${
								pendingBalance > 0
									? "bg-rose-50 dark:bg-rose-950/25"
									: "bg-slate-50 dark:bg-zinc-800/40"
							}`}
						>
							<Text
								className={`font-semibold text-xs ${
									pendingBalance > 0
										? "text-rose-800 dark:text-rose-300"
										: "text-slate-500 dark:text-zinc-400"
								}`}
							>
								Balance Due
							</Text>
							<Text
								className={`my-0.5 font-black text-lg ${
									pendingBalance > 0
										? "text-rose-700 dark:text-rose-400"
										: "text-slate-700 dark:text-zinc-300"
								}`}
							>
								₹{pendingBalance.toLocaleString("en-IN")}
							</Text>
							<Text className="font-medium text-[10px] text-slate-400">
								{pendingBalance > 0 ? "Pending collection" : "Zero due"}
							</Text>
						</View>
					</View>

					{/* Collect Balance Button if Pending */}
					{pendingBalance > 0 && (
						<Pressable
							onPress={handleOpenPayment}
							className="mt-3 flex-row items-center justify-center rounded-xl bg-rose-600 py-3 shadow-xs active:opacity-90"
						>
							<Ionicons
								name="cash-outline"
								size={16}
								color="#ffffff"
								style={{ marginRight: 6 }}
							/>
							<Text className="font-bold text-white text-xs">
								Collect Balance (₹{pendingBalance.toLocaleString("en-IN")})
							</Text>
						</Pressable>
					)}
				</Card>

				{/* 5. PAYMENTS HISTORY FOR THIS INVOICE */}
				{payments.length > 0 && (
					<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<Text className="mb-3 font-bold text-slate-800 text-sm dark:text-white">
							Payment Receipts ({payments.length})
						</Text>

						<View className="gap-2">
							{payments.map((p, idx) => (
								<View
									key={p._id || idx}
									className="flex-row items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60"
								>
									<View className="flex-row items-center gap-2.5">
										<View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60">
											<Ionicons
												name="checkmark-circle"
												size={16}
												color="#10b981"
											/>
										</View>
										<View>
											<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
												{p.paymentMethod || "CASH"} Payment
											</Text>
											<Text className="text-[10px] text-slate-400">
												{p.paymentDate
													? new Date(p.paymentDate).toLocaleDateString([], {
															day: "numeric",
															month: "short",
															year: "numeric",
															hour: "2-digit",
															minute: "2-digit",
														})
													: ""}
												{p.note ? ` • ${p.note}` : ""}
											</Text>
										</View>
									</View>

									<Text className="font-bold text-emerald-600 text-sm dark:text-emerald-400">
										+ ₹{(p.amount || 0).toLocaleString("en-IN")}
									</Text>
								</View>
							))}
						</View>
					</Card>
				)}

				{/* 6. BOTTOM ACTION BAR */}
				<View className="flex-row gap-2.5">
					<Pressable
						onPress={handleGeneralShare}
						className="flex-1 flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3 shadow-xs active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<Ionicons
							name="share-social-outline"
							size={16}
							color={themeColorForeground}
							style={{ marginRight: 6 }}
						/>
						<Text className="font-bold text-slate-700 text-xs dark:text-zinc-200">
							Copy / Share Slip
						</Text>
					</Pressable>

					<Pressable
						onPress={() => {
							router.push({
								pathname: "/billing/create" as any,
								params: { customerId: customerIdStr },
							});
						}}
						className="flex-1 flex-row items-center justify-center rounded-2xl bg-sky-600 py-3 shadow-xs active:opacity-90"
					>
						<Ionicons
							name="add"
							size={18}
							color="#ffffff"
							style={{ marginRight: 4 }}
						/>
						<Text className="font-bold text-white text-xs">New Bill</Text>
					</Pressable>
				</View>
			</ScrollView>

			{/* ================= HEROUI NATIVE BOTTOM SHEET: COLLECT BALANCE PAYMENT ================= */}
			<HeroBottomSheet
				visible={paymentModalVisible}
				onClose={() => setPaymentModalVisible(false)}
				title="Collect Balance Payment"
				subtitle={`Invoice #${sale.invoiceNo} • ${customerName}`}
				snapPoints={["65%", "85%"]}
				footer={
					<View className="flex-row items-center gap-3">
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
									Record Payment
								</Text>
							)}
						</Pressable>
					</View>
				}
			>
				<ScrollView className="py-1" showsVerticalScrollIndicator={false}>
					{/* Due amount badge */}
					<View className="mb-4 rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/20">
						<Text className="font-semibold text-rose-800 text-xs dark:text-rose-300">
							Remaining Balance Due on this Bill:
						</Text>
						<Text className="font-black text-2xl text-rose-700 dark:text-rose-400">
							₹{pendingBalance.toLocaleString("en-IN")}
						</Text>
					</View>

					{/* Amount input */}
					<View className="mb-4">
						<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
							Amount Received (₹) *
						</Text>
						<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800">
							<Text className="mr-1 font-bold text-base text-slate-500">₹</Text>
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

					{/* Payment method selector */}
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

					{/* Optional note */}
					<View className="mb-2">
						<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
							Note / Reference (Optional)
						</Text>
						<TextInput
							value={paymentNote}
							onChangeText={setPaymentNote}
							placeholder="e.g. Paid at shop, GPay ref #..."
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white p-2.5 font-medium text-slate-900 text-xs dark:border-zinc-800 dark:bg-zinc-800 dark:text-white"
						/>
					</View>
				</ScrollView>
			</HeroBottomSheet>
		</Container>
	);
}
