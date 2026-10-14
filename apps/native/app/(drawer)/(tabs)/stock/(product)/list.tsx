import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Image,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProducts } from "@/hooks/queries/use-products";
import type { Product } from "@/services/product.service";

// Bottle Icon / Beverage Graphic Component based on product name/type
function ProductBottleGraphic({ product }: { product: Product }) {
	if (product.image) {
		return (
			<Image
				source={{ uri: product.image }}
				className="h-14 w-9"
				resizeMode="contain"
			/>
		);
	}

	const nameLower = product.name.toLowerCase();
	const isOrange = nameLower.includes("orange");
	const isLime = nameLower.includes("lime") || nameLower.includes("lemon");
	const isCan = nameLower.includes("can");
	const isLarge =
		product.packSize?.includes("1 L") ||
		product.packSize?.includes("1L") ||
		product.packSize?.includes("1.5") ||
		product.packSize?.includes("2 L");

	// Can rendering
	if (isCan) {
		return (
			<View className="h-12 w-8 items-center justify-center rounded-lg bg-red-600 shadow-sm">
				<View className="h-1 w-6 rounded-t bg-slate-300" />
				<View className="my-1 h-7 w-6 items-center justify-center rounded-sm bg-red-700">
					<Text className="font-black text-[7px] text-white italic tracking-tighter">
						Campa
					</Text>
				</View>
				<View className="h-1 w-6 rounded-b bg-slate-400" />
			</View>
		);
	}

	// Bottle Colors
	let liquidBg = "bg-amber-950"; // Default Cola
	let capBg = "bg-red-600";
	let labelText = "Cola";
	let labelBg = "bg-red-600";

	if (isOrange) {
		liquidBg = "bg-orange-500";
		capBg = "bg-orange-600";
		labelText = "Orange";
		labelBg = "bg-white";
	} else if (isLime) {
		liquidBg = "bg-emerald-500";
		capBg = "bg-emerald-600";
		labelText = "Lime";
		labelBg = "bg-white";
	}

	const bottleHeight = isLarge ? "h-14" : "h-12";

	return (
		<View className={`w-8 items-center justify-center ${bottleHeight}`}>
			{/* Bottle Cap */}
			<View className={`h-1.5 w-3 rounded-t-sm ${capBg}`} />
			{/* Bottle Neck */}
			<View className="h-2 w-2 bg-slate-200/40" />
			{/* Bottle Body */}
			<View
				className={`w-7 flex-1 items-center justify-center rounded-t-md rounded-b-lg shadow-sm ${liquidBg} p-0.5`}
			>
				{/* Bottle Label */}
				<View
					className={`w-full items-center justify-center rounded-sm py-0.5 ${labelBg}`}
				>
					<Text
						className={`font-black text-[6px] italic ${
							isOrange || isLime ? "text-slate-900" : "text-white"
						}`}
						numberOfLines={1}
					>
						{labelText}
					</Text>
				</View>
			</View>
		</View>
	);
}

export default function StockListScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("All");
	const [statusFilter, setStatusFilter] = useState<
		"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
	>("ALL");
	const [sortBy, setSortBy] = useState<"NAME" | "STOCK_DESC" | "STOCK_ASC">(
		"NAME",
	);
	const [showFilterModal, setShowFilterModal] = useState(false);
	const [selectedProductAction, setSelectedProductAction] =
		useState<Product | null>(null);

	// Fetch Products from real API
	const {
		data: productsResponse,
		isLoading,
		isRefetching,
		refetch,
	} = useProducts({
		limit: 100,
		isActive: true,
	});

	const products = productsResponse?.data || [];

	// Dynamic Categories with Counts
	const categoriesWithCount = useMemo(() => {
		const counts: Record<string, number> = {
			All: products.length,
		};

		// Track category counts
		products.forEach((p) => {
			const cat = p.category?.trim() || "Beverages";
			counts[cat] = (counts[cat] || 0) + 1;
		});

		// Guarantee common categories if missing
		if (!counts.Beverages) counts.Beverages = 0;
		if (!counts.Snacks) counts.Snacks = 0;
		if (!counts.Others) counts.Others = 0;

		return Object.entries(counts).map(([name, count]) => ({
			name,
			count,
		}));
	}, [products]);

	// Filter and Sort Products
	const filteredProducts = useMemo(() => {
		let list = [...products];

		// 1. Search Query
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(p) =>
					p.name.toLowerCase().includes(q) ||
					p.sku.toLowerCase().includes(q) ||
					p.packSize?.toLowerCase().includes(q) ||
					p.category?.toLowerCase().includes(q),
			);
		}

		// 2. Category Filter
		if (selectedCategory !== "All") {
			list = list.filter((p) => {
				const cat = p.category?.trim() || "Beverages";
				return cat.toLowerCase() === selectedCategory.toLowerCase();
			});
		}

		// 3. Status Filter
		if (statusFilter !== "ALL") {
			list = list.filter((p) => {
				const stock = p.stock || 0;
				const threshold = (p.minimumStock || 0) * (p.unitsPerCase || 1) || 24;
				if (statusFilter === "OUT_OF_STOCK") return stock === 0;
				if (statusFilter === "LOW_STOCK")
					return stock > 0 && stock <= threshold;
				if (statusFilter === "IN_STOCK") return stock > threshold;
				return true;
			});
		}

		// 4. Sorting
		list.sort((a, b) => {
			if (sortBy === "STOCK_DESC") return (b.stock || 0) - (a.stock || 0);
			if (sortBy === "STOCK_ASC") return (a.stock || 0) - (b.stock || 0);
			return a.name.localeCompare(b.name);
		});

		return list;
	}, [products, searchQuery, selectedCategory, statusFilter, sortBy]);

	// Render Product Item Row
	const renderItem = ({ item }: { item: Product }) => {
		const stock = item.stock || 0;
		const minThreshold =
			(item.minimumStock || 0) * (item.unitsPerCase || 1) || 24;

		const isOutOfStock = stock === 0;
		const isLowStock = !isOutOfStock && stock <= minThreshold;

		return (
			<Pressable
				onPress={() => setSelectedProductAction(item)}
				className="flex-row items-center border-slate-100 border-b bg-white px-4 py-3.5 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950"
			>
				{/* 1. Left Product Graphic */}
				<View className="mr-3 h-14 w-12 items-center justify-center">
					<ProductBottleGraphic product={item} />
				</View>

				{/* 2. Middle Product Info */}
				<View className="flex-1 pr-2">
					<Text
						className="font-bold text-[14px] text-slate-900 dark:text-white"
						numberOfLines={1}
					>
						{item.name}
					</Text>
					<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
						SKU: {item.sku}
					</Text>
					<Text className="mt-0.5 text-slate-400 text-xs dark:text-zinc-500">
						{item.packSize || "250 ml"} |{" "}
						{item.unit
							? item.unit.charAt(0).toUpperCase() +
								item.unit.slice(1).toLowerCase()
							: "Bottle"}
					</Text>
				</View>

				{/* 3. Right Quantity & Status Badge */}
				<View className="items-end">
					<Text
						className={`font-extrabold text-[15px] ${
							isOutOfStock ? "text-red-500" : "text-slate-900 dark:text-white"
						}`}
					>
						{stock} pcs
					</Text>

					<View
						className={`mt-1 rounded-full px-2.5 py-0.5 ${
							isOutOfStock
								? "bg-red-50 dark:bg-red-950/40"
								: isLowStock
									? "bg-rose-50 dark:bg-rose-950/40"
									: "bg-emerald-50 dark:bg-emerald-950/40"
						}`}
					>
						<Text
							className={`font-bold text-[11px] ${
								isOutOfStock
									? "text-red-500"
									: isLowStock
										? "text-rose-500"
										: "text-emerald-600 dark:text-emerald-400"
							}`}
						>
							{isOutOfStock
								? "Out of Stock"
								: isLowStock
									? "Low Stock"
									: "In Stock"}
						</Text>
					</View>
				</View>
			</Pressable>
		);
	};

	return (
		<View
			className="flex-1 bg-white dark:bg-zinc-950"
			style={{ paddingTop: insets.top }}
		>
			{/* Top Header */}
			<View className="flex-row items-center justify-between border-slate-100 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
				<View className="flex-row items-center">
					<Pressable
						onPress={() => router.back()}
						hitSlop={12}
						className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-slate-50 active:bg-slate-100 dark:bg-zinc-900"
					>
						<Ionicons name="arrow-back" size={20} color="#1e293b" />
					</Pressable>
					<Text className="font-bold text-lg text-slate-900 dark:text-white">
						Stock List
					</Text>
				</View>
				<Pressable
					onPress={() => router.push("/stock/create" as any)}
					className="flex-row items-center rounded-xl bg-[#f95a24] px-3 py-1.5 shadow-sm active:opacity-90"
				>
					<Ionicons name="add" size={16} color="#ffffff" />
					<Text className="ml-1 font-bold text-white text-xs">Add Product</Text>
				</Pressable>
			</View>

			{/* Search Bar & Filter Button */}
			<View className="flex-row items-center px-4 pt-3 pb-2">
				{/* Search Input Box */}
				<View className="mr-2.5 flex-1 flex-row items-center rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
					<Ionicons name="search" size={18} color="#94a3b8" />
					<TextInput
						value={searchQuery}
						onChangeText={setSearchQuery}
						placeholder="Search product, brand, SKU..."
						placeholderTextColor="#94a3b8"
						className="ml-2 flex-1 font-medium text-slate-900 text-sm dark:text-white"
					/>
					{searchQuery.length > 0 && (
						<Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
							<Ionicons name="close-circle" size={16} color="#94a3b8" />
						</Pressable>
					)}
				</View>

				{/* Filter Button */}
				<Pressable
					onPress={() => setShowFilterModal(true)}
					className={`h-10 w-10 items-center justify-center rounded-xl border ${
						statusFilter !== "ALL" || sortBy !== "NAME"
							? "border-[#f95a24] bg-orange-50 dark:border-[#f95a24] dark:bg-orange-950/40"
							: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
					}`}
				>
					<Ionicons
						name="funnel-outline"
						size={18}
						color={
							statusFilter !== "ALL" || sortBy !== "NAME"
								? "#f95a24"
								: "#334155"
						}
					/>
				</Pressable>
			</View>

			{/* Horizontal Category Chips */}
			<View className="border-slate-100 border-b pb-3 dark:border-zinc-800">
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
				>
					{categoriesWithCount.map((cat) => {
						const isSelected = selectedCategory === cat.name;
						return (
							<Pressable
								key={cat.name}
								onPress={() => setSelectedCategory(cat.name)}
								className={`rounded-xl px-4 py-2 ${
									isSelected
										? "bg-[#f95a24] shadow-sm"
										: "border border-slate-200/80 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<Text
									className={`font-bold text-xs ${
										isSelected
											? "text-white"
											: "text-slate-600 dark:text-zinc-300"
									}`}
								>
									{cat.name} ({cat.count})
								</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			</View>

			{/* Product List */}
			{isLoading ? (
				<View className="flex-1 items-center justify-center py-20">
					<ActivityIndicator size="large" color="#f95a24" />
					<Text className="mt-3 font-semibold text-slate-400 text-xs">
						Loading inventory stock...
					</Text>
				</View>
			) : (
				<FlatList
					data={filteredProducts}
					keyExtractor={(item) => item._id}
					renderItem={renderItem}
					contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={isRefetching}
							onRefresh={refetch}
							colors={["#f95a24"]}
						/>
					}
					ListEmptyComponent={
						<View className="items-center justify-center px-4 py-20">
							<Ionicons name="cube-outline" size={48} color="#cbd5e1" />
							<Text className="mt-3 font-bold text-base text-slate-800 dark:text-zinc-200">
								No stock items found
							</Text>
							<Text className="mt-1 text-center text-slate-400 text-xs">
								{searchQuery
									? `No products match "${searchQuery}"`
									: "No products in this category yet."}
							</Text>
							<Pressable
								onPress={() => router.push("/stock/entry" as any)}
								className="mt-4 rounded-xl bg-[#f95a24] px-4 py-2.5 shadow-sm"
							>
								<Text className="font-bold text-white text-xs">
									+ Add Stock Now
								</Text>
							</Pressable>
						</View>
					}
				/>
			)}

			{/* ================= MODAL: FILTER & SORT ================= */}
			<Modal
				visible={showFilterModal}
				animationType="slide"
				transparent
				onRequestClose={() => setShowFilterModal(false)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<View className="rounded-t-3xl bg-white p-5 dark:bg-zinc-900">
						<View className="mb-4 flex-row items-center justify-between">
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								Filter & Sort Stock
							</Text>
							<Pressable
								onPress={() => setShowFilterModal(false)}
								className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
							>
								<Ionicons name="close" size={18} color="#64748b" />
							</Pressable>
						</View>

						{/* Stock Status Filter */}
						<Text className="mb-2 font-bold text-slate-400 text-xs">
							STOCK STATUS
						</Text>
						<View className="mb-4 flex-row flex-wrap gap-2">
							{(
								[
									{ label: "All Items", val: "ALL" },
									{ label: "In Stock Only", val: "IN_STOCK" },
									{ label: "Low Stock Only", val: "LOW_STOCK" },
									{ label: "Out of Stock", val: "OUT_OF_STOCK" },
								] as const
							).map((s) => (
								<Pressable
									key={s.val}
									onPress={() => setStatusFilter(s.val)}
									className={`rounded-xl px-3.5 py-2 ${
										statusFilter === s.val
											? "bg-[#f95a24]"
											: "border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
									}`}
								>
									<Text
										className={`font-bold text-xs ${
											statusFilter === s.val
												? "text-white"
												: "text-slate-700 dark:text-zinc-300"
										}`}
									>
										{s.label}
									</Text>
								</Pressable>
							))}
						</View>

						{/* Sort Option */}
						<Text className="mb-2 font-bold text-slate-400 text-xs">
							SORT BY
						</Text>
						<View className="mb-6 gap-2">
							{(
								[
									{ label: "Product Name (A-Z)", val: "NAME" },
									{ label: "Stock Quantity (High to Low)", val: "STOCK_DESC" },
									{ label: "Stock Quantity (Low to High)", val: "STOCK_ASC" },
								] as const
							).map((item) => (
								<Pressable
									key={item.val}
									onPress={() => setSortBy(item.val)}
									className={`flex-row items-center justify-between rounded-xl border p-3 ${
										sortBy === item.val
											? "border-[#f95a24] bg-orange-50/50 dark:bg-orange-950/20"
											: "border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-800/40"
									}`}
								>
									<Text className="font-medium text-slate-800 text-sm dark:text-zinc-200">
										{item.label}
									</Text>
									{sortBy === item.val && (
										<Ionicons
											name="checkmark-circle"
											size={18}
											color="#f95a24"
										/>
									)}
								</Pressable>
							))}
						</View>

						{/* Reset & Apply */}
						<View className="flex-row gap-2">
							<Pressable
								onPress={() => {
									setStatusFilter("ALL");
									setSortBy("NAME");
									setShowFilterModal(false);
								}}
								className="flex-1 items-center justify-center rounded-xl bg-slate-100 py-3 dark:bg-zinc-800"
							>
								<Text className="font-bold text-slate-600 text-sm dark:text-zinc-300">
									Reset
								</Text>
							</Pressable>
							<Pressable
								onPress={() => setShowFilterModal(false)}
								className="flex-1 items-center justify-center rounded-xl bg-[#f95a24] py-3"
							>
								<Text className="font-bold text-sm text-white">Apply</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>

			{/* ================= MODAL: QUICK PRODUCT ACTION SHEET ================= */}
			<Modal
				visible={selectedProductAction !== null}
				animationType="slide"
				transparent
				onRequestClose={() => setSelectedProductAction(null)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<View className="rounded-t-3xl bg-white p-5 dark:bg-zinc-900">
						{selectedProductAction && (
							<>
								<View className="mb-3 flex-row items-center justify-between">
									<View className="flex-1 pr-2">
										<Text className="font-bold text-base text-slate-900 dark:text-white">
											{selectedProductAction.name}
										</Text>
										<Text className="text-slate-400 text-xs">
											SKU: {selectedProductAction.sku} •{" "}
											{selectedProductAction.packSize}
										</Text>
									</View>
									<Pressable
										onPress={() => setSelectedProductAction(null)}
										className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
									>
										<Ionicons name="close" size={18} color="#64748b" />
									</Pressable>
								</View>

								{/* Stock Snapshot Cards */}
								<View className="my-3 flex-row gap-2">
									<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
										<Text className="font-semibold text-[10px] text-slate-400">
											CURRENT STOCK
										</Text>
										<Text className="font-bold text-base text-slate-900 dark:text-white">
											{selectedProductAction.stock || 0} pcs
										</Text>
										<Text className="text-[10px] text-slate-400">
											{selectedProductAction.stockDisplay || "0 cases"}
										</Text>
									</View>
									<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
										<Text className="font-semibold text-[10px] text-slate-400">
											BUY RATE
										</Text>
										<Text className="font-bold text-base text-slate-900 dark:text-white">
											₹{selectedProductAction.purchaseRate || 0}
										</Text>
										<Text className="text-[10px] text-slate-400">
											Cost Price
										</Text>
									</View>
									<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
										<Text className="font-semibold text-[10px] text-slate-400">
											SELL RATE
										</Text>
										<Text className="font-bold text-base text-emerald-600 dark:text-emerald-400">
											₹{selectedProductAction.sellingRate || 0}
										</Text>
										<Text className="text-[10px] text-emerald-600">
											Retail Price
										</Text>
									</View>
								</View>

								{/* Action Buttons */}
								<View className="mt-2 gap-2">
									{/* 1. Add Stock for this Product */}
									<Pressable
										onPress={() => {
											setSelectedProductAction(null);
											router.push("/stock/entry" as any);
										}}
										className="flex-row items-center justify-center rounded-xl bg-[#f95a24] py-3 active:opacity-90"
									>
										<Ionicons name="add-circle" size={18} color="#ffffff" />
										<Text className="ml-2 font-bold text-sm text-white">
											+ Add / Purchase Stock
										</Text>
									</Pressable>

									{/* 2. Issue Stock to Worker */}
									<Pressable
										onPress={() => {
											setSelectedProductAction(null);
											router.push("/stock/issue" as any);
										}}
										className="flex-row items-center justify-center rounded-xl bg-[#0d9488] py-3 active:opacity-90"
									>
										<Ionicons
											name="swap-horizontal"
											size={18}
											color="#ffffff"
										/>
										<Text className="ml-2 font-bold text-sm text-white">
											Transfer / Issue Stock
										</Text>
									</Pressable>

									{/* 3. Edit Product Details */}
									<Pressable
										onPress={() => {
											const prodId = selectedProductAction._id;
											setSelectedProductAction(null);
											router.push({
												pathname: "/stock/create" as any,
												params: { id: prodId },
											});
										}}
										className="flex-row items-center justify-center rounded-xl border border-slate-200 bg-white py-3 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
									>
										<Ionicons name="create-outline" size={18} color="#334155" />
										<Text className="ml-2 font-bold text-slate-700 text-sm dark:text-zinc-200">
											Edit Product Details
										</Text>
									</Pressable>

									{/* 4. View Full Product Specs */}
									<Pressable
										onPress={() => {
											const prodId = selectedProductAction._id;
											setSelectedProductAction(null);
											router.push({
												pathname: `/stock/${prodId}` as any,
											});
										}}
										className="flex-row items-center justify-center rounded-xl border border-slate-100 bg-slate-50 py-2.5 active:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
									>
										<Ionicons name="eye-outline" size={16} color="#64748b" />
										<Text className="ml-2 font-semibold text-slate-600 text-xs dark:text-zinc-400">
											View Full Product Specs
										</Text>
									</Pressable>
								</View>
							</>
						)}
					</View>
				</View>
			</Modal>
		</View>
	);
}
