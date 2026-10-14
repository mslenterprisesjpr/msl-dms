import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useThemeColor, useToast } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProducts } from "@/hooks/queries/use-products";
import { apiClient } from "@/lib/api-client";
import type { Product } from "@/services/product.service";

const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const COMMON_SUPPLIERS = [
	"ABC Beverages",
	"Reliance Consumer Products Ltd",
	"Direct Factory Depot",
	"Hindustan Beverages",
	"Jaipur Central Distribution",
	"Custom / Other",
];

function formatDateDisplay(date: Date): string {
	const day = String(date.getDate()).padStart(2, "0");
	const month = MONTH_NAMES[date.getMonth()];
	const year = date.getFullYear();
	return `${day} ${month} ${year}`;
}

export default function AddStockScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// Fetch real catalog products
	const { data: productsData, isLoading: isLoadingProducts } = useProducts({
		page: 1,
		limit: 100,
		isActive: true,
	});

	const products = productsData?.data || [];

	// Form State
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [batchNo, setBatchNo] = useState("BATCH001");
	const [mfgDate, setMfgDate] = useState<Date>(() => new Date());
	const [expiryDate, setExpiryDate] = useState<Date>(() => {
		const nextYear = new Date();
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		return nextYear;
	});
	const [purchaseRate, setPurchaseRate] = useState<string>("15.00");
	const [sellingRate, setSellingRate] = useState<string>("20.00");
	const [quantity, setQuantity] = useState<string>("250");
	const [unit, setUnit] = useState<"pcs" | "cases">("pcs");
	const [supplier, setSupplier] = useState<string>("ABC Beverages");
	const [customSupplier, setCustomSupplier] = useState<string>("");
	const [notes, setNotes] = useState<string>("New stock received");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Modals
	const [showProductPicker, setShowProductPicker] = useState(false);
	const [productSearch, setProductSearch] = useState("");
	const [showSupplierPicker, setShowSupplierPicker] = useState(false);
	const [showDatePicker, setShowDatePicker] = useState<"mfg" | "exp" | null>(
		null,
	);
	const [pickerDateDraft, setPickerDateDraft] = useState<Date>(new Date());

	// Auto-select first product if available and not selected
	useEffect(() => {
		if (products.length > 0 && !selectedProduct) {
			const first = products[0];
			setSelectedProduct(first);
			if (first.purchaseRate !== undefined) {
				setPurchaseRate(String(first.purchaseRate));
			}
			if (first.sellingRate !== undefined) {
				setSellingRate(String(first.sellingRate));
			}
		}
	}, [products, selectedProduct]);

	// Auto-fill rates when user picks a product
	const handleSelectProduct = (product: Product) => {
		setSelectedProduct(product);
		if (product.purchaseRate !== undefined) {
			setPurchaseRate(String(product.purchaseRate));
		}
		if (product.sellingRate !== undefined) {
			setSellingRate(String(product.sellingRate));
		}
		setShowProductPicker(false);
	};

	// Calculate Total Purchase Amount
	const totalAmount = useMemo(() => {
		const qtyNum = Number.parseFloat(quantity) || 0;
		const rateNum = Number.parseFloat(purchaseRate) || 0;
		return qtyNum * rateNum;
	}, [quantity, purchaseRate]);

	// Margin Calculations
	const marginPerUnit = useMemo(() => {
		const p = Number.parseFloat(purchaseRate) || 0;
		const s = Number.parseFloat(sellingRate) || 0;
		return s - p;
	}, [purchaseRate, sellingRate]);

	const marginPercent = useMemo(() => {
		const p = Number.parseFloat(purchaseRate) || 0;
		if (p <= 0) return 0;
		return (marginPerUnit / p) * 100;
	}, [marginPerUnit, purchaseRate]);

	// Filtered products for modal
	const filteredProducts = useMemo(() => {
		if (!productSearch.trim()) return products;
		const q = productSearch.toLowerCase();
		return products.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				p.sku.toLowerCase().includes(q) ||
				p.packSize.toLowerCase().includes(q),
		);
	}, [products, productSearch]);

	// Handle Submit
	const handleSaveStock = async () => {
		if (!selectedProduct) {
			Alert.alert("Select Product", "Please select a product to add stock.");
			return;
		}

		if (!batchNo.trim()) {
			Alert.alert("Batch Required", "Please enter a valid Batch Number.");
			return;
		}

		const numQty = Number.parseFloat(quantity);
		if (!numQty || numQty <= 0) {
			Alert.alert(
				"Invalid Quantity",
				"Please enter a quantity greater than 0.",
			);
			return;
		}

		const numRate = Number.parseFloat(purchaseRate);
		if (isNaN(numRate) || numRate < 0) {
			Alert.alert(
				"Invalid Purchase Rate",
				"Please enter a valid purchase rate.",
			);
			return;
		}

		const numSellingRate = Number.parseFloat(sellingRate);

		const chosenSupplier =
			supplier === "Custom / Other" ? customSupplier.trim() : supplier;

		setIsSubmitting(true);
		try {
			await apiClient.post("/stock/purchase", {
				productId: selectedProduct._id,
				quantity: numQty,
				unit: unit,
				batchNo: batchNo.trim(),
				mfgDate: mfgDate.toISOString(),
				expiryDate: expiryDate.toISOString(),
				purchaseRate: numRate,
				sellingRate: isNaN(numSellingRate) ? undefined : numSellingRate,
				supplier: chosenSupplier || undefined,
				note: notes.trim() || undefined,
			});

			// Invalidate queries so inventory lists update instantly
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.invalidateQueries({ queryKey: ["stock"] });
			queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });

			toast.show({
				variant: "success",
				label: "Stock added successfully!",
			});

			router.back();
		} catch (error: any) {
			console.error("Failed to add stock:", error);
			const errMsg =
				error.response?.data?.message ||
				error.message ||
				"Failed to save stock entry";
			Alert.alert("Error", String(errMsg));
		} finally {
			setIsSubmitting(false);
		}
	};

	// Open Date Picker Modal
	const openDatePicker = (type: "mfg" | "exp") => {
		setPickerDateDraft(
			type === "mfg" ? new Date(mfgDate) : new Date(expiryDate),
		);
		setShowDatePicker(type);
	};

	const saveDatePicker = () => {
		if (showDatePicker === "mfg") {
			setMfgDate(new Date(pickerDateDraft));
		} else if (showDatePicker === "exp") {
			setExpiryDate(new Date(pickerDateDraft));
		}
		setShowDatePicker(null);
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			className="flex-1 bg-white dark:bg-zinc-950"
			style={{ paddingTop: insets.top }}
		>
			{/* Top Header */}
			<View className="flex-row items-center border-slate-100 border-b bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-950">
				<Pressable
					onPress={() => router.back()}
					hitSlop={12}
					className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-slate-50 active:bg-slate-100 dark:bg-zinc-900"
				>
					<Ionicons name="arrow-back" size={20} color={themeColorForeground} />
				</Pressable>
				<Text className="font-bold text-lg text-slate-900 dark:text-white">
					Add Stock
				</Text>
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					padding: 16,
					paddingBottom: insets.bottom + 32,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* 1. PRODUCT SELECTOR */}
				<View className="mb-4">
					<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
						Product <Text className="text-red-500">*</Text>
					</Text>
					<Pressable
						onPress={() => setShowProductPicker(true)}
						className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<View className="mr-2 flex-1 flex-row items-center">
							{/* Bottle Icon / Badge */}
							<View className="mr-3 h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
								<Ionicons name="wine" size={18} color={themeAccent} />
							</View>
							<View className="flex-1">
								<Text
									className="font-semibold text-slate-900 text-sm dark:text-white"
									numberOfLines={1}
								>
									{selectedProduct
										? `${selectedProduct.name} ${selectedProduct.packSize}`
										: "Select Product"}
								</Text>
								{selectedProduct && (
									<Text className="text-[11px] text-slate-400 dark:text-zinc-500">
										Current:{" "}
										{selectedProduct.stockDisplay ||
											`${selectedProduct.stock || 0} units`}
									</Text>
								)}
							</View>
						</View>
						<Ionicons name="chevron-down" size={18} color="#64748b" />
					</Pressable>
				</View>

				{/* 2. BATCH NO. */}
				<View className="mb-4">
					<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
						Batch No. <Text className="text-red-500">*</Text>
					</Text>
					<TextInput
						value={batchNo}
						onChangeText={setBatchNo}
						placeholder="BATCH001"
						placeholderTextColor="#94a3b8"
						autoCapitalize="characters"
						className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-medium text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
					/>
				</View>

				{/* 3. MFG. DATE & EXPIRY DATE (Side by Side) */}
				<View className="mb-4 flex-row gap-3">
					{/* Mfg Date */}
					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							Mfg. Date <Text className="text-red-500">*</Text>
						</Text>
						<Pressable
							onPress={() => openDatePicker("mfg")}
							className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<Text className="font-medium text-slate-800 text-sm dark:text-zinc-200">
								{formatDateDisplay(mfgDate)}
							</Text>
							<Ionicons name="calendar-outline" size={18} color="#64748b" />
						</Pressable>
					</View>

					{/* Expiry Date */}
					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							Expiry Date <Text className="text-red-500">*</Text>
						</Text>
						<Pressable
							onPress={() => openDatePicker("exp")}
							className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<Text className="font-medium text-slate-800 text-sm dark:text-zinc-200">
								{formatDateDisplay(expiryDate)}
							</Text>
							<Ionicons name="calendar-outline" size={18} color="#64748b" />
						</Pressable>
					</View>
				</View>

				{/* 4. PURCHASE RATE & SELLING RATE (Side by Side with Auto Margin Calculation) */}
				<View className="mb-4">
					<View className="flex-row gap-3">
						{/* Purchase Rate (Cost Price) */}
						<View className="flex-1">
							<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
								Purchase Rate (₹) <Text className="text-red-500">*</Text>
							</Text>
							<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-900">
								<Text className="mr-1 font-semibold text-slate-500 text-sm">
									₹
								</Text>
								<TextInput
									value={purchaseRate}
									onChangeText={setPurchaseRate}
									placeholder="15.00"
									placeholderTextColor="#94a3b8"
									keyboardType="decimal-pad"
									className="flex-1 py-1 font-semibold text-slate-900 text-sm dark:text-white"
								/>
							</View>
						</View>

						{/* Selling Rate (Retail Price) */}
						<View className="flex-1">
							<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
								Selling Rate (₹)
							</Text>
							<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-900">
								<Text className="mr-1 font-semibold text-slate-500 text-sm">
									₹
								</Text>
								<TextInput
									value={sellingRate}
									onChangeText={setSellingRate}
									placeholder="20.00"
									placeholderTextColor="#94a3b8"
									keyboardType="decimal-pad"
									className="flex-1 py-1 font-semibold text-slate-900 text-sm dark:text-white"
								/>
							</View>
						</View>
					</View>

					{/* Live Margin Indicator Pill */}
					{Number.parseFloat(purchaseRate) > 0 &&
						Number.parseFloat(sellingRate) > 0 && (
							<View className="mt-2 flex-row items-center justify-between rounded-lg bg-emerald-50/70 px-3 py-1.5 dark:bg-emerald-950/30">
								<View className="flex-row items-center">
									<Ionicons name="trending-up" size={14} color="#059669" />
									<Text className="ml-1 font-semibold text-[11px] text-emerald-700 dark:text-emerald-400">
										Profit Margin: ₹{marginPerUnit.toFixed(2)} (
										{marginPercent.toFixed(1)}%) per unit
									</Text>
								</View>
								<Text className="text-[10px] text-emerald-600 dark:text-emerald-500">
									Auto-syncs
								</Text>
							</View>
						)}
				</View>

				{/* 5. QUANTITY & UNIT (Side by Side) */}
				<View className="mb-4">
					<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
						Quantity <Text className="text-red-500">*</Text>
					</Text>
					<View className="flex-row gap-3">
						<TextInput
							value={quantity}
							onChangeText={setQuantity}
							placeholder="250"
							placeholderTextColor="#94a3b8"
							keyboardType="numeric"
							className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
						{/* Unit Selector Toggle (pcs / cases) */}
						<Pressable
							onPress={() =>
								setUnit((prev) => (prev === "pcs" ? "cases" : "pcs"))
							}
							className="w-28 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<Text className="font-semibold text-slate-800 text-sm dark:text-zinc-200">
								{unit}
							</Text>
							<Ionicons name="chevron-down" size={16} color="#64748b" />
						</Pressable>
					</View>
				</View>

				{/* 6. TOTAL AMOUNT (Soft Tint Card) */}
				<View className="mb-4 rounded-xl border border-sky-100/80 bg-[#f0f6ff] p-4 dark:border-sky-950/60 dark:bg-sky-950/30">
					<Text className="font-semibold text-slate-500 text-xs dark:text-zinc-400">
						Total Amount
					</Text>
					<Text className="mt-1 font-black text-2xl text-slate-900 dark:text-white">
						₹
						{totalAmount.toLocaleString("en-IN", {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						})}
					</Text>
					<View className="mt-0.5 flex-row items-center justify-between">
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							= {quantity || "0"} {unit} × ₹{purchaseRate || "0"} (Cost)
						</Text>
						{Number.parseFloat(sellingRate) > 0 && (
							<Text className="font-semibold text-[11px] text-slate-500 dark:text-zinc-400">
								Est. Sale: ₹
								{(
									(Number.parseFloat(quantity) || 0) *
									(Number.parseFloat(sellingRate) || 0)
								).toLocaleString("en-IN")}
							</Text>
						)}
					</View>
				</View>

				{/* 7. SUPPLIER */}
				<View className="mb-4">
					<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
						Supplier
					</Text>
					<Pressable
						onPress={() => setShowSupplierPicker(true)}
						className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<Text className="font-medium text-slate-800 text-sm dark:text-zinc-200">
							{supplier}
						</Text>
						<Ionicons name="chevron-down" size={18} color="#64748b" />
					</Pressable>

					{supplier === "Custom / Other" && (
						<TextInput
							value={customSupplier}
							onChangeText={setCustomSupplier}
							placeholder="Enter supplier name"
							placeholderTextColor="#94a3b8"
							className="mt-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-medium text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
					)}
				</View>

				{/* 8. NOTES (Optional) */}
				<View className="mb-6">
					<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
						Notes (Optional)
					</Text>
					<TextInput
						value={notes}
						onChangeText={setNotes}
						placeholder="New stock received"
						placeholderTextColor="#94a3b8"
						className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-medium text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
					/>
				</View>

				{/* 9. SAVE STOCK BUTTON */}
				<Pressable
					onPress={handleSaveStock}
					disabled={isSubmitting}
					className="flex-row items-center justify-center rounded-2xl bg-accent py-4 shadow-sm active:opacity-90 disabled:opacity-50"
				>
					{isSubmitting ? (
						<ActivityIndicator size="small" color="#ffffff" />
					) : (
						<>
							<Ionicons
								name="cube-outline"
								size={20}
								color="#ffffff"
								style={{ marginRight: 8 }}
							/>
							<Text className="font-bold text-accent-foreground text-base">
								Save Stock
							</Text>
						</>
					)}
				</Pressable>
			</ScrollView>

			{/* ================= MODAL: SELECT PRODUCT ================= */}
			<Modal
				visible={showProductPicker}
				animationType="slide"
				transparent
				onRequestClose={() => setShowProductPicker(false)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<View className="max-h-[80%] rounded-t-3xl bg-white p-4 dark:bg-zinc-900">
						<View className="mb-3 flex-row items-center justify-between">
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								Select Product
							</Text>
							<View className="flex-row items-center gap-2">
								{/* Quick + Add New Product Button */}
								<Pressable
									onPress={() => {
										setShowProductPicker(false);
										router.push("/stock/create" as any);
									}}
									className="flex-row items-center rounded-lg bg-accent/10 px-2.5 py-1"
								>
									<Ionicons name="add" size={14} color={themeAccent} />
									<Text className="ml-1 font-bold text-accent text-xs">
										New SKU
									</Text>
								</Pressable>

								<Pressable
									onPress={() => setShowProductPicker(false)}
									className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
								>
									<Ionicons name="close" size={18} color="#64748b" />
								</Pressable>
							</View>
						</View>

						{/* Search Input */}
						<View className="mb-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
							<Ionicons name="search" size={16} color="#94a3b8" />
							<TextInput
								value={productSearch}
								onChangeText={setProductSearch}
								placeholder="Search product name or SKU..."
								placeholderTextColor="#94a3b8"
								className="ml-2 flex-1 text-slate-900 text-sm dark:text-white"
							/>
						</View>

						<ScrollView className="max-h-96">
							{isLoadingProducts ? (
								<View className="items-center py-8">
									<ActivityIndicator size="small" color={themeAccent} />
								</View>
							) : filteredProducts.length === 0 ? (
								<View className="items-center py-8">
									<Text className="font-medium text-slate-400 text-sm">
										No products found
									</Text>
								</View>
							) : (
								filteredProducts.map((p) => {
									const isSelected = selectedProduct?._id === p._id;
									return (
										<Pressable
											key={p._id}
											onPress={() => handleSelectProduct(p)}
											className={`mb-2 flex-row items-center justify-between rounded-xl border p-3 ${
												isSelected
													? "border-accent bg-accent/10"
													: "border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-800/40"
											}`}
										>
											<View className="flex-1 pr-2">
												<Text className="font-bold text-slate-900 text-sm dark:text-white">
													{p.name}
												</Text>
												<Text className="text-slate-500 text-xs dark:text-zinc-400">
													Pack: {p.packSize} • {p.unitsPerCase} {p.unit}s/case
												</Text>
												<Text className="font-semibold text-emerald-600 text-xs dark:text-emerald-400">
													Current Stock:{" "}
													{p.stockDisplay || `${p.stock || 0} units`}
												</Text>
											</View>
											<View className="items-end">
												<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
													Buy: ₹{p.purchaseRate || 0}
												</Text>
												<Text className="font-bold text-emerald-600 text-xs dark:text-emerald-400">
													Sell: ₹{p.sellingRate || 0}
												</Text>
											</View>
										</Pressable>
									);
								})
							)}
						</ScrollView>
					</View>
				</View>
			</Modal>

			{/* ================= MODAL: SELECT SUPPLIER ================= */}
			<Modal
				visible={showSupplierPicker}
				animationType="slide"
				transparent
				onRequestClose={() => setShowSupplierPicker(false)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<View className="rounded-t-3xl bg-white p-4 dark:bg-zinc-900">
						<View className="mb-3 flex-row items-center justify-between">
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								Select Supplier
							</Text>
							<Pressable
								onPress={() => setShowSupplierPicker(false)}
								className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
							>
								<Ionicons name="close" size={18} color="#64748b" />
							</Pressable>
						</View>

						<View className="gap-2">
							{COMMON_SUPPLIERS.map((s) => (
								<Pressable
									key={s}
									onPress={() => {
										setSupplier(s);
										setShowSupplierPicker(false);
									}}
									className={`flex-row items-center justify-between rounded-xl border p-3 ${
										supplier === s
											? "border-accent bg-accent/10"
											: "border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-800/40"
									}`}
								>
									<Text className="font-medium text-slate-800 text-sm dark:text-zinc-200">
										{s}
									</Text>
									{supplier === s && (
										<Ionicons
											name="checkmark-circle"
											size={18}
											color={themeAccent}
										/>
									)}
								</Pressable>
							))}
						</View>
					</View>
				</View>
			</Modal>

			{/* ================= MODAL: DATE PICKER ================= */}
			<Modal
				visible={showDatePicker !== null}
				animationType="fade"
				transparent
				onRequestClose={() => setShowDatePicker(null)}
			>
				<View className="flex-1 items-center justify-center bg-black/50 p-4">
					<View className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							{showDatePicker === "mfg"
								? "Set Manufacturing Date"
								: "Set Expiry Date"}
						</Text>
						<Text className="mt-1 text-slate-500 text-xs dark:text-zinc-400">
							Selected: {formatDateDisplay(pickerDateDraft)}
						</Text>

						{/* Quick Presets */}
						<View className="my-4">
							<Text className="mb-2 font-semibold text-slate-400 text-xs">
								QUICK SHORTCUTS
							</Text>
							<View className="flex-row flex-wrap gap-2">
								{showDatePicker === "mfg" ? (
									<>
										<Pressable
											onPress={() => setPickerDateDraft(new Date())}
											className="rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-zinc-800"
										>
											<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
												Today
											</Text>
										</Pressable>
										<Pressable
											onPress={() => {
												const d = new Date();
												d.setDate(d.getDate() - 7);
												setPickerDateDraft(d);
											}}
											className="rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-zinc-800"
										>
											<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
												1 Week Ago
											</Text>
										</Pressable>
										<Pressable
											onPress={() => {
												const d = new Date();
												d.setMonth(d.getMonth() - 1);
												setPickerDateDraft(d);
											}}
											className="rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-zinc-800"
										>
											<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
												1 Month Ago
											</Text>
										</Pressable>
									</>
								) : (
									<>
										<Pressable
											onPress={() => {
												const d = new Date(mfgDate);
												d.setMonth(d.getMonth() + 6);
												setPickerDateDraft(d);
											}}
											className="rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-zinc-800"
										>
											<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
												+6 Months
											</Text>
										</Pressable>
										<Pressable
											onPress={() => {
												const d = new Date(mfgDate);
												d.setFullYear(d.getFullYear() + 1);
												setPickerDateDraft(d);
											}}
											className="rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-zinc-800"
										>
											<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
												+1 Year
											</Text>
										</Pressable>
										<Pressable
											onPress={() => {
												const d = new Date(mfgDate);
												d.setFullYear(d.getFullYear() + 2);
												setPickerDateDraft(d);
											}}
											className="rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-zinc-800"
										>
											<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
												+2 Years
											</Text>
										</Pressable>
									</>
								)}
							</View>
						</View>

						{/* Steppers for Year, Month, Day */}
						<View className="mb-5 flex-row justify-between gap-2">
							{/* Day */}
							<View className="flex-1 items-center rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
								<Text className="font-semibold text-[10px] text-slate-400">
									DAY
								</Text>
								<Text className="my-1 font-bold text-base text-slate-900 dark:text-white">
									{pickerDateDraft.getDate()}
								</Text>
								<View className="flex-row gap-2">
									<Pressable
										onPress={() => {
											const d = new Date(pickerDateDraft);
											d.setDate(d.getDate() - 1);
											setPickerDateDraft(d);
										}}
										className="h-6 w-6 items-center justify-center rounded-md bg-slate-200 dark:bg-zinc-700"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-white">
											-
										</Text>
									</Pressable>
									<Pressable
										onPress={() => {
											const d = new Date(pickerDateDraft);
											d.setDate(d.getDate() + 1);
											setPickerDateDraft(d);
										}}
										className="h-6 w-6 items-center justify-center rounded-md bg-slate-200 dark:bg-zinc-700"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-white">
											+
										</Text>
									</Pressable>
								</View>
							</View>

							{/* Month */}
							<View className="flex-1 items-center rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
								<Text className="font-semibold text-[10px] text-slate-400">
									MONTH
								</Text>
								<Text className="my-1 font-bold text-base text-slate-900 dark:text-white">
									{MONTH_NAMES[pickerDateDraft.getMonth()]}
								</Text>
								<View className="flex-row gap-2">
									<Pressable
										onPress={() => {
											const d = new Date(pickerDateDraft);
											d.setMonth(d.getMonth() - 1);
											setPickerDateDraft(d);
										}}
										className="h-6 w-6 items-center justify-center rounded-md bg-slate-200 dark:bg-zinc-700"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-white">
											-
										</Text>
									</Pressable>
									<Pressable
										onPress={() => {
											const d = new Date(pickerDateDraft);
											d.setMonth(d.getMonth() + 1);
											setPickerDateDraft(d);
										}}
										className="h-6 w-6 items-center justify-center rounded-md bg-slate-200 dark:bg-zinc-700"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-white">
											+
										</Text>
									</Pressable>
								</View>
							</View>

							{/* Year */}
							<View className="flex-1 items-center rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
								<Text className="font-semibold text-[10px] text-slate-400">
									YEAR
								</Text>
								<Text className="my-1 font-bold text-base text-slate-900 dark:text-white">
									{pickerDateDraft.getFullYear()}
								</Text>
								<View className="flex-row gap-2">
									<Pressable
										onPress={() => {
											const d = new Date(pickerDateDraft);
											d.setFullYear(d.getFullYear() - 1);
											setPickerDateDraft(d);
										}}
										className="h-6 w-6 items-center justify-center rounded-md bg-slate-200 dark:bg-zinc-700"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-white">
											-
										</Text>
									</Pressable>
									<Pressable
										onPress={() => {
											const d = new Date(pickerDateDraft);
											d.setFullYear(d.getFullYear() + 1);
											setPickerDateDraft(d);
										}}
										className="h-6 w-6 items-center justify-center rounded-md bg-slate-200 dark:bg-zinc-700"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-white">
											+
										</Text>
									</Pressable>
								</View>
							</View>
						</View>

						{/* Action Buttons */}
						<View className="flex-row gap-2">
							<Pressable
								onPress={() => setShowDatePicker(null)}
								className="flex-1 items-center justify-center rounded-xl bg-slate-100 py-2.5 dark:bg-zinc-800"
							>
								<Text className="font-semibold text-slate-600 text-sm dark:text-zinc-300">
									Cancel
								</Text>
							</Pressable>
							<Pressable
								onPress={saveDatePicker}
								className="flex-1 items-center justify-center rounded-xl bg-accent py-2.5"
							>
								<Text className="font-bold text-accent-foreground text-sm">
									Apply
								</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</KeyboardAvoidingView>
	);
}
