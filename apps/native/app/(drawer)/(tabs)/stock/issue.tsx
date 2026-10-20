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
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { HeroBottomSheet } from "@/components/hero-bottom-sheet";
import { useProducts } from "@/hooks/queries/use-products";
import { useIssueStock } from "@/hooks/queries/use-worker-stock";
import {
	type OrganizationMember,
	useOrganizationMembers,
} from "@/hooks/use-organization-members";
import { authClient } from "@/lib/auth-client";
import type { Product } from "@/services/product.service";

interface CartItem {
	product: Product;
	cases: number;
	units: number;
	totalUnits: number;
	estimatedValue: number;
}

export default function IssueStockScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");

	const { workerId: routeWorkerId } = useLocalSearchParams<{
		workerId?: string;
	}>();

	// Session & Queries
	const { data: session } = authClient.useSession();
	const {
		data: productsData,
		isLoading: isLoadingProducts,
		refetch: refetchProducts,
	} = useProducts(
		{ page: 1, limit: 100, isActive: true },
		{ enabled: !!session },
	);
	const {
		data: members,
		isLoading: isLoadingMembers,
		refetch: refetchMembers,
	} = useOrganizationMembers();
	const issueMutation = useIssueStock();

	// State
	const [selectedMember, setSelectedMember] =
		useState<OrganizationMember | null>(null);
	const [workerPickerVisible, setWorkerPickerVisible] = useState(false);
	const [workerSearch, setWorkerSearch] = useState("");

	const [cart, setCart] = useState<CartItem[]>([]);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [cases, setCases] = useState("");
	const [units, setUnits] = useState("");
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// Modals & Search
	const [showProductModal, setShowProductModal] = useState(false);
	const [productSearch, setProductSearch] = useState("");

	const products = productsData?.data || [];

	// Refresh handler
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([refetchProducts(), refetchMembers()]);
		} finally {
			setRefreshing(false);
		}
	};

	// Auto-select worker if passed via route param
	useEffect(() => {
		if (members && members.length > 0 && !selectedMember) {
			if (routeWorkerId) {
				const matched = members.find((m) => m.userId === routeWorkerId);
				if (matched) {
					setSelectedMember(matched);
					return;
				}
			}
			setSelectedMember(members[0]);
		}
	}, [members, routeWorkerId, selectedMember]);

	// Filter products available for selection
	const availableProducts = useMemo(() => {
		const cartProductIds = new Set(cart.map((item) => item.product._id));
		return products.filter((p) => {
			if (cartProductIds.has(p._id)) return false;
			if (!productSearch.trim()) return true;
			const q = productSearch.toLowerCase();
			return (
				p.name.toLowerCase().includes(q) ||
				p.sku?.toLowerCase().includes(q) ||
				p.packSize?.toLowerCase().includes(q)
			);
		});
	}, [products, cart, productSearch]);

	// Filter workers
	const filteredMembers = useMemo(() => {
		if (!members) return [];
		if (!workerSearch.trim()) return members;
		const q = workerSearch.toLowerCase().trim();
		return members.filter(
			(m) =>
				m.user.name?.toLowerCase().includes(q) ||
				m.user.email?.toLowerCase().includes(q),
		);
	}, [members, workerSearch]);

	// Calculations for current product input
	const currentUnitsPerCase = selectedProduct?.unitsPerCase || 1;
	const enteredCases = Math.max(0, Number.parseInt(cases || "0", 10) || 0);
	const enteredUnits = Math.max(0, Number.parseInt(units || "0", 10) || 0);
	const calculatedTotalUnits =
		enteredCases * currentUnitsPerCase + enteredUnits;
	const availableStock = selectedProduct?.stock || 0;
	const availableCases = Math.floor(availableStock / currentUnitsPerCase);
	const availableLoose = availableStock % currentUnitsPerCase;
	const isStockExceeded = calculatedTotalUnits > availableStock;
	const calculatedValue =
		calculatedTotalUnits *
		(selectedProduct?.sellingRate || selectedProduct?.purchaseRate || 0);

	// Cart totals
	const cartSummary = useMemo(() => {
		let totalCases = 0;
		let totalUnits = 0;
		let totalVal = 0;

		cart.forEach((item) => {
			totalCases += item.cases;
			totalUnits += item.totalUnits;
			totalVal += item.estimatedValue;
		});

		return {
			totalItems: cart.length,
			totalCases,
			totalUnits,
			totalValue: totalVal,
		};
	}, [cart]);

	// Quick step handlers for Cases
	const handleStepCases = (delta: number) => {
		const next = Math.max(0, enteredCases + delta);
		setCases(next.toString());
	};

	const handleAddCurrentToCart = () => {
		if (!selectedProduct) {
			toast.show({ variant: "danger", label: "Please select a product first" });
			return;
		}

		if (calculatedTotalUnits <= 0) {
			toast.show({
				variant: "danger",
				label: "Please enter at least 1 case or unit to issue",
			});
			return;
		}

		if (isStockExceeded) {
			toast.show({
				variant: "danger",
				label: `Insufficient warehouse stock (${availableStock} available)`,
			});
			return;
		}

		setCart((prev) => [
			...prev,
			{
				product: selectedProduct,
				cases: enteredCases,
				units: enteredUnits,
				totalUnits: calculatedTotalUnits,
				estimatedValue: calculatedValue,
			},
		]);

		toast.show({
			variant: "success",
			label: `${selectedProduct.name} added to dispatch manifest`,
		});

		// Reset inputs
		setSelectedProduct(null);
		setCases("");
		setUnits("");
	};

	const handleRemoveCartItem = (productId: string) => {
		setCart((prev) => prev.filter((item) => item.product._id !== productId));
	};

	const handleSubmitIssue = async () => {
		if (!selectedMember) {
			toast.show({ variant: "danger", label: "Please select a worker" });
			return;
		}

		if (cart.length === 0) {
			toast.show({
				variant: "danger",
				label: "Manifest is empty. Add at least 1 product.",
			});
			return;
		}

		const breakdown = cart
			.map(
				(item) =>
					`• ${item.product.name}: ${item.cases > 0 ? `${item.cases} cs ` : ""}${item.units > 0 ? `${item.units} pcs` : ""} (${item.totalUnits} units)`,
			)
			.join("\n");

		const workerDisplayName =
			selectedMember?.user?.name || selectedMember?.user?.email || "Worker";

		Alert.alert(
			"Confirm Stock Issue",
			`Issue ${cartSummary.totalUnits} units (${cartSummary.totalCases} cases) to ${workerDisplayName}?\n\n${breakdown}`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Confirm Issue",
					style: "default",
					onPress: async () => {
						setIsSubmitting(true);
						try {
							for (const item of cart) {
								await issueMutation.mutateAsync({
									workerId: selectedMember.userId,
									productId: item.product._id,
									quantity: item.totalUnits,
									cases: item.cases,
									units: item.units,
									note: note.trim() || undefined,
								});
							}

							toast.show({
								variant: "success",
								label: `Stock successfully issued to ${workerDisplayName}!`,
							});

							setCart([]);
							setSelectedProduct(null);
							setCases("");
							setUnits("");
							setNote("");
							router.back();
						} catch (error: any) {
							console.error("Issue stock error:", error);
							Alert.alert(
								"Issue Failed",
								error.response?.data?.message ||
									error.message ||
									"Failed to issue stock to worker",
							);
						} finally {
							setIsSubmitting(false);
						}
					},
				},
			],
		);
	};

	if (isLoadingProducts || isLoadingMembers) {
		return (
			<Container className="flex-1 items-center justify-center bg-slate-50 dark:bg-zinc-950">
				<ActivityIndicator size="small" color={themeAccent} />
				<Text className="mt-3 font-medium text-slate-500 text-xs dark:text-zinc-400">
					Loading inventory catalog...
				</Text>
			</Container>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			className="flex-1"
		>
			<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
				<ScrollView
					className="flex-1"
					contentContainerStyle={{
						padding: 16,
						paddingBottom: insets.bottom + 120,
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
					    STEP 1: SELECT WORKER (Hero Card with Sheet Picker)
					══════════════════════════════════════════════════════════════ */}
					<View className="mb-5">
						<View className="mb-2.5 flex-row items-center justify-between">
							<View className="flex-row items-center">
								<View className="mr-2 h-6 w-6 items-center justify-center rounded-full bg-accent">
									<Text className="font-bold text-white text-xs">1</Text>
								</View>
								<Text className="font-bold text-base text-slate-900 dark:text-white">
									Select Field Worker / Van
								</Text>
							</View>

							{members && members.length > 1 && (
								<Pressable
									onPress={() => setWorkerPickerVisible(true)}
									className="rounded-lg bg-accent/10 px-2.5 py-1 active:bg-accent/20"
								>
									<Text className="font-bold text-accent text-xs">
										Change Worker ▾
									</Text>
								</Pressable>
							)}
						</View>

						{/* Active Worker Card */}
						<Pressable
							onPress={() => setWorkerPickerVisible(true)}
							className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm active:opacity-90 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<View className="flex-row items-center justify-between">
								<View className="flex-row items-center">
									<View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-accent/15">
										<Ionicons name="person" size={22} color={themeAccent} />
									</View>
									<View>
										<Text className="font-bold text-base text-slate-900 dark:text-white">
											{selectedMember?.user?.name ||
												selectedMember?.user?.email ||
												"Select Worker"}
										</Text>
										<Text className="text-slate-400 text-xs">
											{selectedMember?.user?.email || "Delivery Van Rep"} •{" "}
											{selectedMember?.role === "admin"
												? "Admin"
												: "Field Worker"}
										</Text>
									</View>
								</View>

								<Ionicons
									name="chevron-forward"
									size={18}
									color={themeColorForeground}
								/>
							</View>
						</Pressable>
					</View>

					{/* ══════════════════════════════════════════════════════════════
					    STEP 2: SELECT PRODUCT & CONFIGURE CASES
					══════════════════════════════════════════════════════════════ */}
					<View className="mb-5">
						<View className="mb-2.5 flex-row items-center justify-between">
							<View className="flex-row items-center">
								<View className="mr-2 h-6 w-6 items-center justify-center rounded-full bg-accent">
									<Text className="font-bold text-white text-xs">2</Text>
								</View>
								<Text className="font-bold text-base text-slate-900 dark:text-white">
									Select Product & Dispatch Load
								</Text>
							</View>
						</View>

						{/* Product Selector Button Card */}
						<Pressable
							onPress={() => setShowProductModal(true)}
							className="mb-3 flex-row items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm active:opacity-90 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<View className="flex-1 flex-row items-center pr-3">
								<View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-accent/15">
									<Ionicons name="cube-outline" size={22} color={themeAccent} />
								</View>
								<View className="flex-1">
									<Text
										numberOfLines={1}
										className="font-bold text-base text-slate-900 dark:text-white"
									>
										{selectedProduct
											? selectedProduct.name
											: "Tap to choose product from catalog..."}
									</Text>
									<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
										{selectedProduct
											? `${selectedProduct.packSize ? `${selectedProduct.packSize} • ` : ""}${selectedProduct.unitsPerCase} units/case • Stock: ${selectedProduct.stock} ${selectedProduct.unit || "pcs"}`
											: `${availableProducts.length} items available in warehouse`}
									</Text>
								</View>
							</View>
							<Ionicons
								name="chevron-forward"
								size={18}
								color={themeColorForeground}
							/>
						</Pressable>

						{/* Quantity Input Section (When product is selected) */}
						{selectedProduct && (
							<Card className="border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
								{/* Warehouse Available Stock Strip */}
								<View className="mb-4 flex-row items-center justify-between rounded-2xl bg-slate-50 p-3.5 dark:bg-zinc-800/60">
									<View>
										<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
											Warehouse Godown Stock:
										</Text>
										<View className="mt-0.5 flex-row items-baseline gap-1.5">
											<Text className="font-black text-emerald-600 text-xl dark:text-emerald-400">
												{availableCases} Cases
											</Text>
											{availableLoose > 0 && (
												<Text className="font-bold text-emerald-700 text-xs dark:text-emerald-300">
													+{availableLoose} loose
												</Text>
											)}
										</View>
									</View>

									<View className="items-end">
										<Text className="font-semibold text-slate-400 text-xs">
											Case Packing
										</Text>
										<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
											{currentUnitsPerCase} pcs / case
										</Text>
										<Text className="font-semibold text-[11px] text-slate-400">
											Rate: ₹
											{selectedProduct.sellingRate ||
												selectedProduct.purchaseRate ||
												0}
										</Text>
									</View>
								</View>

								{/* PRIMARY CASES STEPPER (Cases-First) */}
								<View className="mb-3">
									<Text className="mb-1.5 font-bold text-slate-700 text-xs uppercase tracking-wider dark:text-zinc-300">
										Cases to Dispatch *
									</Text>

									<View className="flex-row items-center gap-2">
										<Pressable
											onPress={() => handleStepCases(-1)}
											disabled={enteredCases <= 0}
											className="h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 active:bg-slate-200 disabled:opacity-40 dark:bg-zinc-800"
										>
											<Ionicons
												name="remove"
												size={24}
												color={themeColorForeground}
											/>
										</Pressable>

										<View className="flex-1 flex-row items-center rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800">
											<TextInput
												value={cases}
												onChangeText={setCases}
												placeholder="0"
												placeholderTextColor="#94a3b8"
												keyboardType="number-pad"
												className="flex-1 text-center font-black text-2xl text-slate-900 dark:text-white"
											/>
											<Text className="font-bold text-slate-400 text-xs">
												Cases
											</Text>
										</View>

										<Pressable
											onPress={() => handleStepCases(1)}
											className="h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 active:bg-slate-200 dark:bg-zinc-800"
										>
											<Ionicons
												name="add"
												size={24}
												color={themeColorForeground}
											/>
										</Pressable>
									</View>
								</View>

								{/* QUICK PRESET BUTTONS FOR CASES */}
								<View className="mb-3 flex-row flex-wrap gap-2">
									{[1, 2, 5, 10].map((preset) => (
										<Pressable
											key={preset}
											onPress={() => setCases(preset.toString())}
											className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 active:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800"
										>
											<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
												+{preset} cs
											</Text>
										</Pressable>
									))}
									<Pressable
										onPress={() => {
											setCases(availableCases.toString());
											setUnits(availableLoose.toString());
										}}
										className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 active:bg-accent/20"
									>
										<Text className="font-black text-accent text-xs">
											All Stock ({availableCases} cs)
										</Text>
									</Pressable>
								</View>

								{/* SECONDARY FRACTIONAL LOOSE PIECES */}
								<View className="mb-3">
									<Text className="mb-1 font-semibold text-slate-500 text-xs dark:text-zinc-400">
										+ Additional Loose Pieces (Optional):
									</Text>
									<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
										<TextInput
											placeholder="0"
											placeholderTextColor="#94a3b8"
											keyboardType="number-pad"
											value={units}
											onChangeText={setUnits}
											className="flex-1 font-bold text-base text-slate-900 dark:text-white"
										/>
										<Text className="font-semibold text-slate-400 text-xs">
											{selectedProduct.unit || "pcs"}
										</Text>
									</View>
								</View>

								{/* LIVE CALCULATION PILL */}
								{calculatedTotalUnits > 0 && (
									<View
										className={`mb-3.5 rounded-2xl p-3 ${
											isStockExceeded
												? "bg-red-50 dark:bg-red-950/30"
												: "bg-emerald-50 dark:bg-emerald-950/30"
										}`}
									>
										<View className="flex-row items-center justify-between">
											<Text
												className={`font-bold text-xs ${
													isStockExceeded
														? "text-red-700 dark:text-red-400"
														: "text-emerald-800 dark:text-emerald-300"
												}`}
											>
												{isStockExceeded
													? "⚠️ Stock limit exceeded!"
													: "✓ Issue Quantity Ready"}
											</Text>
											<Text
												className={`font-black text-sm ${
													isStockExceeded
														? "text-red-700 dark:text-red-400"
														: "text-emerald-700 dark:text-emerald-400"
												}`}
											>
												{calculatedTotalUnits} Units (
												{enteredCases > 0 ? `${enteredCases} cs ` : ""}
												{enteredUnits > 0 ? `+ ${enteredUnits} pcs` : ""})
											</Text>
										</View>
										<Text
											className={`mt-1 font-medium text-[11px] ${
												isStockExceeded
													? "text-red-600 dark:text-red-400/80"
													: "text-emerald-600 dark:text-emerald-400/80"
											}`}
										>
											{isStockExceeded
												? `Available in warehouse is only ${availableStock} units.`
												: `Est. Stock Value: ₹${(calculatedValue ?? 0).toLocaleString("en-IN")}`}
										</Text>
									</View>
								)}

								{/* Add to Manifest Button */}
								<Pressable
									onPress={handleAddCurrentToCart}
									disabled={calculatedTotalUnits <= 0 || isStockExceeded}
									className={`flex-row items-center justify-center rounded-2xl py-3.5 active:opacity-90 ${
										calculatedTotalUnits <= 0 || isStockExceeded
											? "bg-slate-200 dark:bg-zinc-800"
											: "bg-accent shadow-sm"
									}`}
								>
									<Ionicons
										name="add-circle"
										size={18}
										color={
											calculatedTotalUnits <= 0 || isStockExceeded
												? "#94a3b8"
												: "#ffffff"
										}
										style={{ marginRight: 6 }}
									/>
									<Text
										className={`font-bold text-sm ${
											calculatedTotalUnits <= 0 || isStockExceeded
												? "text-slate-400 dark:text-zinc-500"
												: "text-white"
										}`}
									>
										+ Add to Van Dispatch Manifest
									</Text>
								</Pressable>
							</Card>
						)}
					</View>

					{/* ══════════════════════════════════════════════════════════════
					    STEP 3: VAN DISPATCH MANIFEST (ITEMS QUEUED)
					══════════════════════════════════════════════════════════════ */}
					{cart.length > 0 && (
						<View className="mb-5">
							<View className="mb-2.5 flex-row items-center justify-between">
								<View className="flex-row items-center">
									<View className="mr-2 h-6 w-6 items-center justify-center rounded-full bg-accent">
										<Text className="font-bold text-white text-xs">3</Text>
									</View>
									<Text className="font-bold text-base text-slate-900 dark:text-white">
										Dispatch Manifest ({cart.length} items)
									</Text>
								</View>
								<Pressable
									onPress={() => setCart([])}
									className="rounded-lg bg-red-50 px-2 py-1 dark:bg-red-950/40"
								>
									<Text className="font-bold text-red-600 text-xs dark:text-red-400">
										Clear All
									</Text>
								</Pressable>
							</View>

							{/* Manifest Summary Strip */}
							<View className="mb-3 flex-row items-center justify-between rounded-2xl bg-sky-50 p-3.5 dark:bg-sky-950/30">
								<View>
									<Text className="font-medium text-sky-800 text-xs dark:text-sky-300">
										Total Dispatch Load
									</Text>
									<Text className="font-black text-lg text-sky-900 dark:text-sky-200">
										{cartSummary.totalCases} cs ({cartSummary.totalUnits} units)
									</Text>
								</View>
								<View className="items-end">
									<Text className="font-medium text-sky-800 text-xs dark:text-sky-300">
										Estimated Value
									</Text>
									<Text className="font-black text-lg text-sky-900 dark:text-sky-200">
										₹{(cartSummary?.totalValue ?? 0).toLocaleString("en-IN")}
									</Text>
								</View>
							</View>

							{/* Item Cards */}
							<View className="gap-2">
								{cart.map((item) => (
									<Card
										key={item.product._id}
										className="border border-slate-100 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
									>
										<View className="flex-row items-center justify-between">
											<View className="flex-1 pr-3">
												<Text
													numberOfLines={1}
													className="font-bold text-slate-900 text-sm dark:text-white"
												>
													{item.product.name}
												</Text>
												<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
													{item.cases > 0 ? `${item.cases} Cases ` : ""}
													{item.units > 0 ? `+ ${item.units} Pcs ` : ""}(
													{item.totalUnits} total units)
												</Text>
											</View>
											<View className="flex-row items-center gap-3">
												<Text className="font-bold text-slate-900 text-sm dark:text-white">
													₹{(item?.estimatedValue ?? 0).toLocaleString("en-IN")}
												</Text>
												<Pressable
													onPress={() => handleRemoveCartItem(item.product._id)}
													className="h-8 w-8 items-center justify-center rounded-lg bg-red-50 active:bg-red-100 dark:bg-red-950/40"
												>
													<Ionicons
														name="trash-outline"
														size={16}
														color="#ef4444"
													/>
												</Pressable>
											</View>
										</View>
									</Card>
								))}
							</View>
						</View>
					)}

					{/* ══════════════════════════════════════════════════════════════
					    STEP 4: DISPATCH NOTE
					══════════════════════════════════════════════════════════════ */}
					{cart.length > 0 && (
						<View className="mb-4">
							<Text className="mb-2 font-bold text-slate-700 text-xs dark:text-zinc-300">
								Dispatch Note / Route (Optional)
							</Text>
							<TextInput
								value={note}
								onChangeText={setNote}
								placeholder="e.g. Morning Van Load, Route #2 Mansarovar..."
								placeholderTextColor="#94a3b8"
								className="rounded-2xl border border-slate-200 bg-white p-3.5 font-medium text-slate-900 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
							/>
						</View>
					)}
				</ScrollView>

				{/* STICKY BOTTOM CONFIRMATION BAR */}
				{cart.length > 0 && (
					<View
						style={{ paddingBottom: Math.max(insets.bottom, 12) }}
						className="absolute right-0 bottom-0 left-0 border-slate-200 border-t bg-white/95 px-4 pt-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95"
					>
						<View className="flex-row items-center gap-3">
							<View className="flex-1">
								<Text className="font-medium text-slate-400 text-xs dark:text-zinc-500">
									Dispatching to{" "}
									{selectedMember?.user?.name ||
										selectedMember?.user?.email ||
										"Worker"}
								</Text>
								<Text className="font-black text-base text-slate-900 dark:text-white">
									{cartSummary.totalCases} cs ({cartSummary?.totalUnits ?? 0}{" "}
									pcs)
								</Text>
							</View>

							<Pressable
								onPress={handleSubmitIssue}
								disabled={isSubmitting}
								className="flex-row items-center justify-center rounded-2xl bg-accent px-5 py-3.5 shadow-sm active:opacity-90"
							>
								{isSubmitting ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<>
										<Ionicons
											name="checkmark-circle"
											size={18}
											color="#ffffff"
											style={{ marginRight: 6 }}
										/>
										<Text className="font-bold text-sm text-white">
											Issue Stock
										</Text>
									</>
								)}
							</Pressable>
						</View>
					</View>
				)}

				{/* ══════════════════════════════════════════════════════════════
				    HEROUI NATIVE BOTTOM SHEET: PRODUCT PICKER
				══════════════════════════════════════════════════════════════ */}
				<HeroBottomSheet
					visible={showProductModal}
					onClose={() => setShowProductModal(false)}
					title="Select Product to Issue"
					subtitle="Choose an item from the warehouse catalog"
					snapPoints={["70%", "90%"]}
				>
					{/* Search Bar */}
					<View className="mb-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800">
						<Ionicons
							name="search"
							size={18}
							color="#94a3b8"
							style={{ marginRight: 8 }}
						/>
						<TextInput
							placeholder="Search product by name or pack size..."
							placeholderTextColor="#94a3b8"
							value={productSearch}
							onChangeText={setProductSearch}
							className="flex-1 font-medium text-slate-900 text-sm dark:text-white"
						/>
						{productSearch.length > 0 && (
							<Pressable onPress={() => setProductSearch("")}>
								<Ionicons name="close-circle" size={16} color="#94a3b8" />
							</Pressable>
						)}
					</View>

					{/* Products List */}
					<ScrollView showsVerticalScrollIndicator={false}>
						{availableProducts.length === 0 ? (
							<View className="items-center py-10">
								<Ionicons name="cube-outline" size={36} color="#94a3b8" />
								<Text className="mt-2 font-medium text-slate-400 text-xs dark:text-zinc-500">
									No products match your search
								</Text>
							</View>
						) : (
							<View className="gap-2">
								{availableProducts.map((p) => {
									const inStock = (p.stock || 0) > 0;
									const pCases = Math.floor(
										(p.stock || 0) / (p.unitsPerCase || 1),
									);
									const pUnits = (p.stock || 0) % (p.unitsPerCase || 1);

									return (
										<Pressable
											key={p._id}
											onPress={() => {
												setSelectedProduct(p);
												setCases("");
												setUnits("");
												setShowProductModal(false);
											}}
											className="flex-row items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 active:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/60"
										>
											<View className="flex-1 pr-3">
												<Text
													numberOfLines={1}
													className="font-bold text-slate-900 text-sm dark:text-white"
												>
													{p.name}
												</Text>
												<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
													{p.packSize ? `${p.packSize} • ` : ""}
													{p.unitsPerCase} pcs/case
												</Text>
											</View>

											<View className="items-end">
												<Text
													className={`font-black text-sm ${
														inStock
															? "text-emerald-600 dark:text-emerald-400"
															: "text-red-500"
													}`}
												>
													{pCases} cs {pUnits > 0 ? `+ ${pUnits} pcs` : ""}
												</Text>
												<Text className="font-semibold text-[11px] text-slate-400 dark:text-zinc-500">
													Rate: ₹{p.sellingRate || p.purchaseRate || 0}
												</Text>
											</View>
										</Pressable>
									);
								})}
							</View>
						)}
					</ScrollView>
				</HeroBottomSheet>

				{/* ══════════════════════════════════════════════════════════════
				    HEROUI NATIVE BOTTOM SHEET: WORKER PICKER
				══════════════════════════════════════════════════════════════ */}
				<HeroBottomSheet
					visible={workerPickerVisible}
					onClose={() => setWorkerPickerVisible(false)}
					title="Select Field Worker / Van"
					subtitle="Pick a delivery agent or worker to issue stock to"
					snapPoints={["60%", "85%"]}
				>
					{/* Search in workers */}
					<View className="mb-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
						<Ionicons
							name="search"
							size={14}
							color="#94a3b8"
							style={{ marginRight: 6 }}
						/>
						<TextInput
							placeholder="Search worker by name or email..."
							placeholderTextColor="#94a3b8"
							value={workerSearch}
							onChangeText={setWorkerSearch}
							className="flex-1 font-medium text-slate-900 text-xs dark:text-white"
						/>
					</View>

					{/* Members list */}
					<ScrollView showsVerticalScrollIndicator={false}>
						<View className="gap-2">
							{filteredMembers.map((m) => {
								const isSelected = selectedMember?.userId === m.userId;
								return (
									<Pressable
										key={m.id}
										onPress={() => {
											setSelectedMember(m);
											setWorkerPickerVisible(false);
										}}
										className={`flex-row items-center justify-between rounded-2xl border p-3 ${
											isSelected
												? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/30"
												: "border-slate-100 bg-slate-50/50 active:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/40"
										}`}
									>
										<View className="flex-row items-center gap-3">
											<View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-200/60 dark:bg-zinc-700">
												<Ionicons
													name="person"
													size={16}
													color={themeColorForeground}
												/>
											</View>
											<View>
												<Text className="font-bold text-slate-900 text-xs dark:text-white">
													{m.user.name}
												</Text>
												<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
													{m.user.email} • {m.role}
												</Text>
											</View>
										</View>
										{isSelected && (
											<Ionicons
												name="checkmark-circle"
												size={20}
												color="#0284c7"
											/>
										)}
									</Pressable>
								);
							})}
						</View>
					</ScrollView>
				</HeroBottomSheet>
			</Container>
		</KeyboardAvoidingView>
	);
}
