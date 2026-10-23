import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { HeroBottomSheet } from "@/components/hero-bottom-sheet";
import { useCustomers } from "@/hooks/queries/use-customers";
import { useProducts } from "@/hooks/queries/use-products";
import { useCreateSale, useSale } from "@/hooks/queries/use-sales";
import { useWorkerStock } from "@/hooks/queries/use-worker-stock";
import { useUserRole } from "@/hooks/use-user-role";
import { useSession } from "@/lib/hooks/use-session";
import type { Customer } from "@/types/customer";

interface BillCartItem {
	productId: string;
	productName: string;
	sku?: string;
	packSize?: string;
	unit: string;
	unitsPerCase: number;
	availableUnits: number;
	availableCases: number;
	cases: number;
	units: number;
	totalUnits: number;
	price: number;
	lineTotal: number;
}

export default function CreateBillScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { toast } = useToast();
	const { user } = useSession();
	const { isAdmin } = useUserRole();
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");

	const params = useLocalSearchParams<{
		customerId?: string;
		reorderSaleId?: string;
		duplicateFrom?: string;
	}>();

	// Mode for stock selection: Worker uses Van Stock by default
	const [stockSource, setStockSource] = useState<"VAN" | "WAREHOUSE">(
		isAdmin ? "WAREHOUSE" : "VAN",
	);

	useEffect(() => {
		setStockSource(isAdmin ? "WAREHOUSE" : "VAN");
	}, [isAdmin]);

	// Customer state
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
		null,
	);
	const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
	const [customerSearch, setCustomerSearch] = useState("");

	// Cart state
	const [cart, setCart] = useState<BillCartItem[]>([]);
	const [productSearch, setProductSearch] = useState("");

	// Financials & Payment state
	const [discountText, setDiscountText] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<
		"CASH" | "UPI" | "CARD" | "CREDIT" | "SPLIT"
	>("CASH");
	const [isPartialCustom, setIsPartialCustom] = useState(false);
	const [paidAmountText, setPaidAmountText] = useState("");
	const [splitCashText, setSplitCashText] = useState("");
	const [splitUpiText, setSplitUpiText] = useState("");
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Queries
	const { data: customersResponse, isLoading: isLoadingCustomers } =
		useCustomers({ limit: 100 });
	const { data: warehouseProductsResponse, isLoading: isLoadingWarehouse } =
		useProducts({ limit: 100, isActive: true });
	const { data: vanStockResponse, isLoading: isLoadingVan } = useWorkerStock();
	const createSaleMutation = useCreateSale();

	const customers = customersResponse?.data || [];
	const warehouseProducts = warehouseProductsResponse?.data || [];
	const vanStockItems = vanStockResponse?.data || [];

	// Optional re-order / duplicate bill query
	const reorderId = params.reorderSaleId || params.duplicateFrom;
	const { data: pastSale } = useSale(reorderId || "", {
		enabled: !!reorderId,
	});

	// Pre-select customer from route params or past sale
	useEffect(() => {
		if (customers.length > 0 && !selectedCustomer) {
			const targetId =
				params.customerId ||
				(pastSale?.customerId &&
					(typeof pastSale.customerId === "object"
						? pastSale.customerId._id
						: pastSale.customerId));

			if (targetId) {
				const matched = customers.find((c) => c._id === targetId);
				if (matched) {
					setSelectedCustomer(matched);
					return;
				}
			}
			// Default to first customer if available
			if (customers[0]) {
				setSelectedCustomer(customers[0]);
			}
		}
	}, [customers, params.customerId, pastSale, selectedCustomer]);

	// Filtered customers for picker
	const filteredCustomers = useMemo(() => {
		if (!customerSearch.trim()) return customers;
		const q = customerSearch.toLowerCase().trim();
		return customers.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				(c.phone && c.phone.includes(q)) ||
				(c.gstNumber && c.gstNumber.toLowerCase().includes(q)),
		);
	}, [customers, customerSearch]);

	// Unified available products based on stockSource
	const availableCatalog = useMemo(() => {
		if (stockSource === "VAN") {
			return vanStockItems.map((item) => {
				const pId =
					typeof item.productId === "object"
						? item.productId._id
						: item.productId || item._id;
				const unitsPerCase = Math.max(
					1,
					item.unitsPerCase ||
						(typeof item.productId === "object"
							? item.productId.unitsPerCase || 1
							: 1),
				);
				const totalStock = item.quantity ?? item.stock ?? 0;
				const cases =
					item.stockInCases ?? Math.floor(totalStock / unitsPerCase);
				const loose = item.remainingUnits ?? totalStock % unitsPerCase;

				return {
					_id: pId,
					name:
						item.productName ||
						(typeof item.productId === "object"
							? item.productId.name
							: "Product"),
					sku:
						item.sku ||
						(typeof item.productId === "object"
							? item.productId.sku
							: undefined),
					packSize:
						item.packSize ||
						(typeof item.productId === "object"
							? item.productId.packSize
							: undefined),
					unit:
						item.unit ||
						(typeof item.productId === "object" ? item.productId.unit : "pcs"),
					unitsPerCase,
					sellingRate:
						item.sellingRate ||
						(typeof item.productId === "object"
							? item.productId.sellingRate || 0
							: 0),
					availableUnits: totalStock,
					availableCases: cases,
					availableLoose: loose,
					isVanStock: true,
				};
			});
		}

		// Warehouse Catalog (for Admin)
		return warehouseProducts.map((p) => {
			const unitsPerCase = p.unitsPerCase || 1;
			const totalStock = p.stock || 0;
			const cases = Math.floor(totalStock / unitsPerCase);
			const loose = totalStock % unitsPerCase;

			return {
				_id: p._id,
				name: p.name,
				sku: p.sku,
				packSize: p.packSize,
				unit: p.unit || "pcs",
				unitsPerCase,
				sellingRate: p.sellingRate || p.purchaseRate || 0,
				availableUnits: totalStock,
				availableCases: cases,
				availableLoose: loose,
				isVanStock: false,
			};
		});
	}, [stockSource, vanStockItems, warehouseProducts]);

	// Filtered products for search
	const filteredProducts = useMemo(() => {
		if (!productSearch.trim()) return availableCatalog;
		const q = productSearch.toLowerCase().trim();
		return availableCatalog.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				(p.sku && p.sku.toLowerCase().includes(q)) ||
				(p.packSize && p.packSize.toLowerCase().includes(q)),
		);
	}, [availableCatalog, productSearch]);

	// Cart item adjustment functions (Cases-First)
	const handleUpdateCartCases = (
		prod: (typeof availableCatalog)[0],
		delta: number,
	) => {
		setCart((prev) => {
			const existingIndex = prev.findIndex((i) => i.productId === prod._id);
			if (existingIndex >= 0) {
				const existing = prev[existingIndex];
				const newCases = Math.max(0, existing.cases + delta);
				const newTotalUnits = newCases * existing.unitsPerCase + existing.units;

				if (newTotalUnits <= 0) {
					return prev.filter((i) => i.productId !== prod._id);
				}

				// Check available stock
				if (newTotalUnits > existing.availableUnits) {
					toast.show({
						variant: "danger",
						label: `Only ${existing.availableUnits} units available!`,
					});
					return prev;
				}

				const updated = [...prev];
				updated[existingIndex] = {
					...existing,
					cases: newCases,
					totalUnits: newTotalUnits,
					lineTotal: newTotalUnits * existing.price,
				};
				return updated;
			}

			// Add new item if delta > 0
			if (delta > 0) {
				const totalUnits = delta * prod.unitsPerCase;
				if (totalUnits > prod.availableUnits) {
					toast.show({
						variant: "danger",
						label: `Only ${prod.availableUnits} units available!`,
					});
					return prev;
				}

				return [
					...prev,
					{
						productId: prod._id,
						productName: prod.name,
						sku: prod.sku,
						packSize: prod.packSize,
						unit: prod.unit,
						unitsPerCase: prod.unitsPerCase,
						availableUnits: prod.availableUnits,
						availableCases: prod.availableCases,
						cases: delta,
						units: 0,
						totalUnits,
						price: prod.sellingRate,
						lineTotal: totalUnits * prod.sellingRate,
					},
				];
			}

			return prev;
		});
	};

	const handleUpdateCartUnits = (
		prod: (typeof availableCatalog)[0],
		delta: number,
	) => {
		setCart((prev) => {
			const existingIndex = prev.findIndex((i) => i.productId === prod._id);
			if (existingIndex >= 0) {
				const existing = prev[existingIndex];
				const newUnits = Math.max(0, existing.units + delta);
				const newTotalUnits = existing.cases * existing.unitsPerCase + newUnits;

				if (newTotalUnits <= 0) {
					return prev.filter((i) => i.productId !== prod._id);
				}

				if (newTotalUnits > existing.availableUnits) {
					toast.show({
						variant: "danger",
						label: `Only ${existing.availableUnits} units available!`,
					});
					return prev;
				}

				const updated = [...prev];
				updated[existingIndex] = {
					...existing,
					units: newUnits,
					totalUnits: newTotalUnits,
					lineTotal: newTotalUnits * existing.price,
				};
				return updated;
			}

			if (delta > 0) {
				if (delta > prod.availableUnits) {
					toast.show({
						variant: "danger",
						label: `Only ${prod.availableUnits} units available!`,
					});
					return prev;
				}

				return [
					...prev,
					{
						productId: prod._id,
						productName: prod.name,
						sku: prod.sku,
						packSize: prod.packSize,
						unit: prod.unit,
						unitsPerCase: prod.unitsPerCase,
						availableUnits: prod.availableUnits,
						availableCases: prod.availableCases,
						cases: 0,
						units: delta,
						totalUnits: delta,
						price: prod.sellingRate,
						lineTotal: delta * prod.sellingRate,
					},
				];
			}

			return prev;
		});
	};

	// Remove item completely
	const handleRemoveCartItem = (productId: string) => {
		setCart((prev) => prev.filter((i) => i.productId !== productId));
	};

	// Financial Calculations
	const subtotal = useMemo(() => {
		return cart.reduce((sum, item) => sum + item.lineTotal, 0);
	}, [cart]);

	const discount = Math.max(0, Number.parseFloat(discountText || "0") || 0);
	const netTotal = Math.max(0, subtotal - discount);

	// Total cases & total loose in cart
	const cartCasesTotal = useMemo(() => {
		return cart.reduce((sum, item) => sum + item.cases, 0);
	}, [cart]);

	const cartUnitsTotal = useMemo(() => {
		return cart.reduce((sum, item) => sum + item.totalUnits, 0);
	}, [cart]);

	// Determine final paid amount based on method and inputs
	const calculatedPaidAmount = useMemo(() => {
		if (paymentMethod === "CREDIT") return 0;
		if (paymentMethod === "SPLIT") {
			const cash = Number.parseFloat(splitCashText || "0") || 0;
			const upi = Number.parseFloat(splitUpiText || "0") || 0;
			return Math.min(netTotal, Math.max(0, cash + upi));
		}
		if (isPartialCustom) {
			const customVal = Number.parseFloat(paidAmountText || "0") || 0;
			return Math.min(netTotal, Math.max(0, customVal));
		}
		// Full payment for CASH, UPI, CARD
		return netTotal;
	}, [
		paymentMethod,
		isPartialCustom,
		paidAmountText,
		splitCashText,
		splitUpiText,
		netTotal,
	]);

	const calculatedPendingBalance = Math.max(0, netTotal - calculatedPaidAmount);

	// Submit Bill to Backend (Aligned with POST /sales schema)
	const handleSubmit = async () => {
		if (!selectedCustomer?._id) {
			toast.show({
				variant: "danger",
				label: "Please select a customer for the bill",
			});
			return;
		}

		if (cart.length === 0) {
			toast.show({
				variant: "danger",
				label: "Please add at least 1 product to the bill",
			});
			return;
		}

		// Ensure all items have valid quantities
		const invalidItem = cart.find((i) => i.cases === 0 && i.units === 0);
		if (invalidItem) {
			toast.show({
				variant: "danger",
				label: `Please enter cases or units for ${invalidItem.productName}`,
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const paymentsList: Array<{
				amount: number;
				paymentMethod: "CASH" | "UPI" | "CARD" | "CREDIT";
			}> = [];

			if (paymentMethod === "SPLIT") {
				const cash = Number.parseFloat(splitCashText || "0") || 0;
				const upi = Number.parseFloat(splitUpiText || "0") || 0;
				if (cash > 0)
					paymentsList.push({ amount: cash, paymentMethod: "CASH" });
				if (upi > 0) paymentsList.push({ amount: upi, paymentMethod: "UPI" });
			} else if (paymentMethod !== "CREDIT" && calculatedPaidAmount > 0) {
				paymentsList.push({
					amount: calculatedPaidAmount,
					paymentMethod,
				});
			}

			// Backend expects: customerId, items (productId, cases, units, price), discount, paymentMethod, paidAmount, payments, note
			const salePayload = {
				customerId: selectedCustomer._id,
				items: cart.map((item) => ({
					productId: item.productId,
					cases: Math.max(0, Math.floor(Number(item.cases) || 0)),
					units: Math.max(0, Math.floor(Number(item.units) || 0)),
					price: Math.max(0, Number(item.price) || 0),
				})),
				discount: Math.max(0, Number(discount) || 0),
				paymentMethod: paymentMethod === "SPLIT" ? "CASH" : paymentMethod,
				paidAmount: Math.max(0, Number(calculatedPaidAmount) || 0),
				payments: paymentsList.length > 0 ? paymentsList : undefined,
				note: note.trim() || undefined,
			};

			const newSale = await createSaleMutation.mutateAsync(salePayload as any);

			toast.show({
				variant: "success",
				label: "Bill generated successfully! Redirecting to slip...",
			});

			// Redirect directly to Invoice Detail Screen with WhatsApp Share Slip
			const saleId = newSale?._id;
			if (saleId) {
				router.replace({
					pathname: "/billing/[id]" as any,
					params: { id: saleId },
				});
			} else {
				router.replace("/billing" as any);
			}
		} catch (error: any) {
			console.error("Sale creation error:", error);
			const data = error?.response?.data;
			let errMessage = "Failed to generate bill";
			if (typeof data?.message === "string") {
				errMessage = data.message;
			} else if (typeof data?.error === "string") {
				errMessage = data.error;
			} else if (data?.issues && Array.isArray(data.issues)) {
				errMessage = data.issues
					.map((i: any) => `${i.path?.join(".") || "field"}: ${i.message}`)
					.join(", ");
			} else if (data?.error?.issues && Array.isArray(data.error.issues)) {
				errMessage = data.error.issues
					.map((i: any) => `${i.path?.join(".") || "field"}: ${i.message}`)
					.join(", ");
			} else if (error?.message) {
				errMessage = error.message;
			}
			Alert.alert("Billing Failed", errMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	const isLoading = stockSource === "VAN" ? isLoadingVan : isLoadingWarehouse;

	return (
		<Container
			isScrollable={false}
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
		>
			{/* Top Header */}
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
							New Spot Bill (Invoice)
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							{stockSource === "VAN"
								? "🚚 Selling from Live Van Stock"
								: "🏭 Selling from Warehouse Catalog"}
						</Text>
					</View>
				</View>

				{/* Source Toggle (if Admin) */}
				{isAdmin && (
					<View className="flex-row rounded-lg bg-slate-100 p-0.5 dark:bg-zinc-800">
						<Pressable
							onPress={() => setStockSource("VAN")}
							className={`rounded-md px-2 py-1 ${
								stockSource === "VAN"
									? "bg-white shadow-xs dark:bg-zinc-700"
									: ""
							}`}
						>
							<Text
								className={`font-bold text-[10px] ${
									stockSource === "VAN" ? "text-accent" : "text-slate-500"
								}`}
							>
								Van Stock
							</Text>
						</Pressable>
						<Pressable
							onPress={() => setStockSource("WAREHOUSE")}
							className={`rounded-md px-2 py-1 ${
								stockSource === "WAREHOUSE"
									? "bg-white shadow-xs dark:bg-zinc-700"
									: ""
							}`}
						>
							<Text
								className={`font-bold text-[10px] ${
									stockSource === "WAREHOUSE" ? "text-accent" : "text-slate-500"
								}`}
							>
								Warehouse
							</Text>
						</Pressable>
					</View>
				)}
			</View>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1"
			>
				<ScrollView
					className="flex-1"
					contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
					showsVerticalScrollIndicator={false}
				>
					{/* 1. SELECT CUSTOMER CARD */}
					<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between border-slate-100 border-b pb-2.5 dark:border-zinc-800">
							<Text className="font-bold text-slate-800 text-sm dark:text-white">
								1. Select Party / Customer *
							</Text>
							<Pressable
								onPress={() => setCustomerPickerVisible(true)}
								className="flex-row items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 active:opacity-75 dark:bg-sky-950/40"
							>
								<Ionicons name="people" size={13} color="#0284c7" />
								<Text className="font-bold text-[11px] text-sky-700 dark:text-sky-300">
									Change Party
								</Text>
							</Pressable>
						</View>

						{selectedCustomer ? (
							<Pressable
								onPress={() => setCustomerPickerVisible(true)}
								className="mt-3 flex-row items-center justify-between"
							>
								<View className="flex-1 pr-2">
									<View className="flex-row items-center gap-1.5">
										<Ionicons name="storefront" size={16} color="#0284c7" />
										<Text className="font-black text-base text-slate-900 dark:text-white">
											{selectedCustomer.name}
										</Text>
									</View>
									<Text className="mt-0.5 text-slate-400 text-xs dark:text-zinc-500">
										{selectedCustomer.phone
											? `📞 ${selectedCustomer.phone} • `
											: ""}
										{selectedCustomer.address || "No address specified"}
									</Text>
								</View>
								<Ionicons name="chevron-forward" size={16} color="#94a3b8" />
							</Pressable>
						) : (
							<Pressable
								onPress={() => setCustomerPickerVisible(true)}
								className="mt-3 items-center justify-center rounded-xl border border-sky-300 border-dashed bg-sky-50/50 py-3 active:opacity-80 dark:border-sky-800 dark:bg-sky-950/20"
							>
								<Text className="font-bold text-sky-700 text-xs dark:text-sky-300">
									+ Tap to Select Customer / Dukandar
								</Text>
							</Pressable>
						)}
					</Card>

					{/* 2. ADD PRODUCTS (CASES-FIRST VAN INVENTORY) */}
					<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="mb-3 flex-row items-center justify-between border-slate-100 border-b pb-2.5 dark:border-zinc-800">
							<View>
								<Text className="font-bold text-slate-800 text-sm dark:text-white">
									2. Add Products from{" "}
									{stockSource === "VAN" ? "Van" : "Godown"}
								</Text>
								<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
									Cases-first wholesale billing with live stock check
								</Text>
							</View>
							<View className="rounded-lg bg-teal-50 px-2 py-0.5 dark:bg-teal-950/40">
								<Text className="font-bold text-[10px] text-teal-800 dark:text-teal-300">
									{availableCatalog.length} In Stock
								</Text>
							</View>
						</View>

						{/* Product Search */}
						<View className="mb-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
							<Ionicons name="search" size={15} color="#94a3b8" />
							<TextInput
								value={productSearch}
								onChangeText={setProductSearch}
								placeholder="Search product name, SKU, pack..."
								placeholderTextColor="#94a3b8"
								className="ml-2 flex-1 font-medium text-slate-900 text-xs dark:text-white"
							/>
							{productSearch.length > 0 && (
								<Pressable onPress={() => setProductSearch("")} hitSlop={6}>
									<Ionicons name="close-circle" size={15} color="#94a3b8" />
								</Pressable>
							)}
						</View>

						{isLoading ? (
							<View className="items-center py-6">
								<ActivityIndicator size="small" color={themeAccent} />
								<Text className="mt-2 font-medium text-slate-400 text-xs">
									Loading stock...
								</Text>
							</View>
						) : filteredProducts.length === 0 ? (
							<View className="items-center py-6">
								<Ionicons name="cube-outline" size={32} color="#cbd5e1" />
								<Text className="mt-2 font-semibold text-slate-600 text-xs dark:text-zinc-400">
									{stockSource === "VAN"
										? "Aapki gaadi me koi available stock nahi hai."
										: "No products found matching search."}
								</Text>
								{stockSource === "VAN" && (
									<Pressable
										onPress={() => router.push("/stock/issue" as any)}
										className="mt-2.5 rounded-xl bg-accent px-3 py-1.5"
									>
										<Text className="font-bold text-accent-foreground text-xs">
											+ Load Stock from Warehouse
										</Text>
									</Pressable>
								)}
							</View>
						) : (
							<View className="gap-2.5">
								{filteredProducts.map((prod) => {
									const cartItem = cart.find((i) => i.productId === prod._id);
									const currentCases = cartItem?.cases || 0;
									const currentUnits = cartItem?.units || 0;
									const inCart = !!cartItem;

									return (
										<View
											key={prod._id}
											className={`rounded-2xl border p-3 ${
												inCart
													? "border-sky-300 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/20"
													: "border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/60"
											}`}
										>
											{/* Top row: Name, SKU, Available Stock */}
											<View className="flex-row items-start justify-between">
												<View className="flex-1 pr-2">
													<Text className="font-bold text-slate-900 text-sm dark:text-white">
														{prod.name}
													</Text>
													<Text className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
														{prod.sku ? `SKU: ${prod.sku} • ` : ""}
														{prod.packSize ? `${prod.packSize} • ` : ""}
														{prod.unitsPerCase} pcs/cs
													</Text>
												</View>

												{/* Stock in vehicle / godown */}
												<View className="items-end">
													<View className="flex-row items-center rounded-lg bg-teal-50 px-2 py-0.5 dark:bg-teal-950/60">
														<Text className="font-black text-teal-800 text-xs dark:text-teal-300">
															{prod.availableCases} cs
															{prod.availableLoose > 0
																? ` + ${prod.availableLoose}`
																: ""}
														</Text>
													</View>
													<Text className="mt-0.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
														₹{prod.sellingRate} / pc
													</Text>
												</View>
											</View>

											{/* Bottom Controls: Cases Stepper & Loose Units Stepper */}
											<View className="mt-3 flex-row items-center justify-between border-slate-200/60 border-t pt-2.5 dark:border-zinc-800">
												{/* Cases Stepper */}
												<View className="flex-row items-center gap-1.5">
													<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
														Cases:
													</Text>
													<Pressable
														onPress={() => handleUpdateCartCases(prod, -1)}
														disabled={currentCases <= 0}
														className="h-7 w-7 items-center justify-center rounded-lg bg-slate-200 active:opacity-75 dark:bg-zinc-700"
													>
														<Text className="font-black text-slate-800 text-xs dark:text-white">
															−
														</Text>
													</Pressable>

													<View className="h-7 min-w-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-800">
														<Text className="font-black text-slate-900 text-xs dark:text-white">
															{currentCases}
														</Text>
													</View>

													<Pressable
														onPress={() => handleUpdateCartCases(prod, 1)}
														className="h-7 w-7 items-center justify-center rounded-lg bg-accent active:opacity-75"
													>
														<Text className="font-black text-accent-foreground text-xs">
															+
														</Text>
													</Pressable>
												</View>

												{/* Loose Units Stepper */}
												<View className="flex-row items-center gap-1.5">
													<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
														Loose:
													</Text>
													<Pressable
														onPress={() => handleUpdateCartUnits(prod, -1)}
														disabled={currentUnits <= 0}
														className="h-7 w-7 items-center justify-center rounded-lg bg-slate-200 active:opacity-75 dark:bg-zinc-700"
													>
														<Text className="font-black text-slate-800 text-xs dark:text-white">
															−
														</Text>
													</Pressable>

													<View className="h-7 min-w-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-800">
														<Text className="font-black text-slate-900 text-xs dark:text-white">
															{currentUnits}
														</Text>
													</View>

													<Pressable
														onPress={() => handleUpdateCartUnits(prod, 1)}
														className="h-7 w-7 items-center justify-center rounded-lg bg-accent active:opacity-75"
													>
														<Text className="font-black text-accent-foreground text-xs">
															+
														</Text>
													</Pressable>
												</View>
											</View>
										</View>
									);
								})}
							</View>
						)}
					</Card>

					{/* 3. CURRENT CART SUMMARY */}
					{cart.length > 0 && (
						<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<View className="mb-3 flex-row items-center justify-between border-slate-100 border-b pb-2 dark:border-zinc-800">
								<Text className="font-bold text-slate-800 text-sm dark:text-white">
									3. Manifest & Billed Items ({cart.length})
								</Text>
								<Text className="font-bold text-sky-600 text-xs dark:text-sky-400">
									{cartCasesTotal} Cases ({cartUnitsTotal} units)
								</Text>
							</View>

							<View className="gap-2.5">
								{cart.map((item) => (
									<View
										key={item.productId}
										className="flex-row items-center justify-between border-slate-100 border-b pb-2 last:border-b-0 dark:border-zinc-800"
									>
										<View className="flex-1 pr-2">
											<Text className="font-bold text-slate-900 text-xs dark:text-white">
												{item.productName}
											</Text>
											<Text className="text-[11px] text-slate-400">
												{item.cases > 0 ? `${item.cases} cs` : ""}
												{item.cases > 0 && item.units > 0
													? ` + ${item.units} pcs`
													: ""}
												{item.cases === 0 ? `${item.units} pcs` : ""} @ ₹
												{item.price}
											</Text>
										</View>

										<View className="flex-row items-center gap-3">
											<Text className="font-black text-slate-900 text-sm dark:text-white">
												₹{item.lineTotal.toLocaleString("en-IN")}
											</Text>
											<Pressable
												onPress={() => handleRemoveCartItem(item.productId)}
												hitSlop={8}
											>
												<Ionicons
													name="trash-outline"
													size={16}
													color="#ef4444"
												/>
											</Pressable>
										</View>
									</View>
								))}
							</View>
						</Card>
					)}

					{/* 4. TOTALS, DISCOUNT & PAYMENT MODE */}
					{cart.length > 0 && (
						<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
							<Text className="mb-3 font-bold text-slate-800 text-sm dark:text-white">
								4. Payment Terms & Settlement
							</Text>

							{/* Subtotal */}
							<View className="mb-2 flex-row items-center justify-between">
								<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
									Subtotal ({cart.length} items)
								</Text>
								<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
									₹{subtotal.toLocaleString("en-IN")}
								</Text>
							</View>

							{/* Discount Row */}
							<View className="mb-3 flex-row items-center justify-between">
								<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
									Special Discount (₹)
								</Text>
								<View className="h-8 w-24 flex-row items-center rounded-lg border border-slate-200 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-800">
									<Text className="mr-1 font-semibold text-slate-400 text-xs">
										₹
									</Text>
									<TextInput
										keyboardType="numeric"
										value={discountText}
										onChangeText={setDiscountText}
										placeholder="0"
										placeholderTextColor="#94a3b8"
										className="flex-1 font-bold text-slate-900 text-xs dark:text-white"
									/>
								</View>
							</View>

							{/* Grand Total */}
							<View className="mb-4 flex-row items-center justify-between border-slate-100 border-t pt-2.5 dark:border-zinc-800">
								<Text className="font-black text-base text-slate-900 dark:text-white">
									Grand Total
								</Text>
								<Text className="font-black text-2xl text-slate-900 tracking-tight dark:text-white">
									₹{netTotal.toLocaleString("en-IN")}
								</Text>
							</View>

							{/* Payment Method Switcher */}
							<Text className="mb-2 font-bold text-slate-700 text-xs dark:text-zinc-300">
								Payment Mode:
							</Text>
							<View className="mb-3 flex-row gap-2">
								{(["CASH", "UPI", "SPLIT", "CREDIT"] as const).map((method) => {
									const isSelected = paymentMethod === method;
									return (
										<Pressable
											key={method}
											onPress={() => {
												setPaymentMethod(method);
												setIsPartialCustom(false);
											}}
											className={`flex-1 items-center justify-center rounded-xl py-2.5 ${
												isSelected
													? method === "CREDIT"
														? "bg-rose-600"
														: method === "SPLIT"
															? "bg-purple-700"
															: "bg-slate-900 dark:bg-white"
													: "border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
											}`}
										>
											<Text
												className={`font-black text-[11px] ${
													isSelected
														? method === "CREDIT" || method === "SPLIT"
															? "text-white"
															: "text-white dark:text-zinc-900"
														: "text-slate-600 dark:text-zinc-400"
												}`}
											>
												{method === "CREDIT"
													? "⏳ UDHAR"
													: method === "SPLIT"
														? "🔀 SPLIT"
														: method}
											</Text>
										</Pressable>
									);
								})}
							</View>

							{/* Split Payment (Cash + UPI + Udhar) */}
							{paymentMethod === "SPLIT" && (
								<View className="mb-3 rounded-xl border border-purple-200/80 bg-purple-50/60 p-3 dark:border-purple-800/40 dark:bg-purple-950/20">
									<Text className="mb-2 font-bold text-purple-900 text-xs dark:text-purple-300">
										Split Payment (Cash + UPI + Udhar)
									</Text>
									<View className="mb-2 flex-row gap-2">
										<View className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
											<Text className="font-medium text-[10px] text-slate-500">
												💵 Cash Amount
											</Text>
											<TextInput
												keyboardType="numeric"
												value={splitCashText}
												onChangeText={setSplitCashText}
												placeholder="0"
												placeholderTextColor="#94a3b8"
												className="font-bold text-slate-900 text-xs dark:text-white"
											/>
										</View>
										<View className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
											<Text className="font-medium text-[10px] text-slate-500">
												📱 UPI Amount
											</Text>
											<TextInput
												keyboardType="numeric"
												value={splitUpiText}
												onChangeText={setSplitUpiText}
												placeholder="0"
												placeholderTextColor="#94a3b8"
												className="font-bold text-slate-900 text-xs dark:text-white"
											/>
										</View>
									</View>
									<View className="flex-row items-center justify-between border-purple-200/50 border-t pt-1.5 dark:border-purple-800/30">
										<Text className="font-semibold text-[11px] text-purple-800 dark:text-purple-300">
											Total Paid: ₹
											{calculatedPaidAmount.toLocaleString("en-IN")}
										</Text>
										<Text
											className={`font-bold text-[11px] ${
												calculatedPendingBalance > 0
													? "text-rose-600 dark:text-rose-400"
													: "text-emerald-600 dark:text-emerald-400"
											}`}
										>
											{calculatedPendingBalance > 0
												? `Udhar: ₹${calculatedPendingBalance.toLocaleString("en-IN")}`
												: "✓ Full Paid"}
										</Text>
									</View>
								</View>
							)}

							{/* Partial Payment Option for CASH/UPI */}
							{paymentMethod !== "CREDIT" && paymentMethod !== "SPLIT" && (
								<View className="mb-3 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
									<View className="flex-row items-center justify-between">
										<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-300">
											Partial Payment received?
										</Text>
										<Pressable
											onPress={() => {
												setIsPartialCustom(!isPartialCustom);
												if (!isPartialCustom) {
													setPaidAmountText(netTotal.toString());
												}
											}}
											className="rounded-lg bg-slate-200 px-2 py-0.5 dark:bg-zinc-700"
										>
											<Text className="font-bold text-[10px] text-slate-700 dark:text-zinc-300">
												{isPartialCustom ? "Custom Amount ➔" : "Full Paid ✓"}
											</Text>
										</Pressable>
									</View>

									{isPartialCustom && (
										<View className="mt-2 flex-row items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
											<Text className="mr-1 font-bold text-slate-500 text-xs">
												Amount Received: ₹
											</Text>
											<TextInput
												keyboardType="numeric"
												value={paidAmountText}
												onChangeText={setPaidAmountText}
												placeholder={netTotal.toString()}
												placeholderTextColor="#94a3b8"
												className="flex-1 font-bold text-slate-900 text-xs dark:text-white"
											/>
										</View>
									)}
								</View>
							)}

							{/* Balance Due Notice */}
							<View className="flex-row items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/40">
								<View>
									<Text className="font-medium text-[11px] text-slate-400">
										Immediate Cash/UPI:
									</Text>
									<Text className="font-bold text-emerald-600 text-sm dark:text-emerald-400">
										₹{calculatedPaidAmount.toLocaleString("en-IN")}
									</Text>
								</View>
								<View className="items-end">
									<Text className="font-medium text-[11px] text-slate-400">
										Added to Khata Due:
									</Text>
									<Text
										className={`font-black text-sm ${
											calculatedPendingBalance > 0
												? "text-rose-600 dark:text-rose-400"
												: "text-slate-700 dark:text-zinc-300"
										}`}
									>
										₹{calculatedPendingBalance.toLocaleString("en-IN")}
									</Text>
								</View>
							</View>

							{/* Bill Remark / Note */}
							<View className="mt-3">
								<Text className="mb-1 font-semibold text-[11px] text-slate-500 dark:text-zinc-400">
									Bill Remark / Note (Optional):
								</Text>
								<TextInput
									value={note}
									onChangeText={setNote}
									placeholder="e.g. Delivery at back godown, signed by Munshi"
									placeholderTextColor="#94a3b8"
									className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 text-xs dark:border-zinc-800 dark:bg-zinc-800 dark:text-white"
								/>
							</View>
						</Card>
					)}
				</ScrollView>

				{/* STICKY BOTTOM GENERATE BILL BUTTON */}
				<View
					style={{ paddingBottom: Math.max(insets.bottom, 12) }}
					className="border-slate-200 border-t bg-white px-4 pt-3 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<Pressable
						onPress={handleSubmit}
						disabled={isSubmitting || cart.length === 0}
						className={`flex-row items-center justify-center rounded-2xl py-3.5 shadow-sm active:opacity-90 ${
							cart.length === 0 || isSubmitting
								? "bg-slate-300 dark:bg-zinc-800"
								: "bg-emerald-600"
						}`}
					>
						{isSubmitting ? (
							<ActivityIndicator size="small" color="#ffffff" />
						) : (
							<>
								<Ionicons name="receipt-outline" size={20} color="#ffffff" />
								<Text className="ml-2 font-black text-base text-white">
									{cart.length === 0
										? "Add Products to Generate Bill"
										: `Confirm Bill • ₹${netTotal.toLocaleString("en-IN")} ➔`}
								</Text>
							</>
						)}
					</Pressable>
				</View>
			</KeyboardAvoidingView>

			{/* ================= HEROUI BOTTOM SHEET: CUSTOMER PICKER ================= */}
			<HeroBottomSheet
				visible={customerPickerVisible}
				onClose={() => setCustomerPickerVisible(false)}
				title="Select Customer / Party"
				subtitle="Whose account will be billed"
				snapPoints={["75%", "90%"]}
			>
				<View className="flex-1 py-1">
					{/* Search Customer Input */}
					<View className="mb-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
						<Ionicons name="search" size={16} color="#94a3b8" />
						<TextInput
							value={customerSearch}
							onChangeText={setCustomerSearch}
							placeholder="Search by shop name, phone or GST..."
							placeholderTextColor="#94a3b8"
							className="ml-2 flex-1 font-medium text-slate-900 text-xs dark:text-white"
						/>
						{customerSearch.length > 0 && (
							<Pressable onPress={() => setCustomerSearch("")} hitSlop={6}>
								<Ionicons name="close-circle" size={15} color="#94a3b8" />
							</Pressable>
						)}
					</View>

					<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
						{filteredCustomers.length === 0 ? (
							<View className="items-center py-8">
								<Ionicons name="people-outline" size={36} color="#cbd5e1" />
								<Text className="mt-2 font-bold text-slate-700 text-xs dark:text-zinc-300">
									No customers found
								</Text>
								<Pressable
									onPress={() => {
										setCustomerPickerVisible(false);
										router.push("/billing/customer-create" as any);
									}}
									className="mt-3 rounded-xl bg-accent px-3.5 py-2"
								>
									<Text className="font-bold text-accent-foreground text-xs">
										+ Add New Customer
									</Text>
								</Pressable>
							</View>
						) : (
							<View className="gap-2 pb-6">
								{filteredCustomers.map((cust) => {
									const isSelected = selectedCustomer?._id === cust._id;
									return (
										<Pressable
											key={cust._id}
											onPress={() => {
												setSelectedCustomer(cust);
												setCustomerPickerVisible(false);
											}}
											className={`flex-row items-center justify-between rounded-2xl border p-3.5 active:opacity-80 ${
												isSelected
													? "border-sky-500 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/40"
													: "border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
											}`}
										>
											<View className="flex-1 pr-3">
												<Text className="font-bold text-slate-900 text-sm dark:text-white">
													{cust.name}
												</Text>
												<Text className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
													{cust.phone ? `📞 ${cust.phone} • ` : ""}
													{cust.address || "No address"}
												</Text>
											</View>

											{isSelected && (
												<Ionicons
													name="checkmark-circle"
													size={22}
													color="#0284c7"
												/>
											)}
										</Pressable>
									);
								})}
							</View>
						)}
					</ScrollView>
				</View>
			</HeroBottomSheet>
		</Container>
	);
}
