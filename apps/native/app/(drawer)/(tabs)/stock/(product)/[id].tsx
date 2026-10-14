import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useMemo } from "react";
import {
	ActivityIndicator,
	Image,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProduct } from "@/hooks/queries/use-products";

export default function ProductDetailsScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { id } = useLocalSearchParams<{ id?: string }>();

	const { data: productResponse, isLoading } = useProduct(id || "");
	const product = productResponse?.data;

	const marginPerUnit = useMemo(() => {
		if (!product) return 0;
		return (product.sellingRate || 0) - (product.purchaseRate || 0);
	}, [product]);

	const marginPercent = useMemo(() => {
		if (!product?.purchaseRate || product.purchaseRate <= 0) return 0;
		return (marginPerUnit / product.purchaseRate) * 100;
	}, [marginPerUnit, product]);

	if (isLoading || !product) {
		return (
			<View className="flex-1 items-center justify-center bg-white dark:bg-zinc-950">
				<ActivityIndicator size="large" color={themeAccent} />
				<Text className="mt-3 font-semibold text-slate-400 text-xs">
					Loading product details...
				</Text>
			</View>
		);
	}

	const stock = product.stock || 0;
	const minThreshold =
		(product.minimumStock || 0) * (product.unitsPerCase || 1) || 24;
	const isOutOfStock = stock === 0;
	const isLowStock = !isOutOfStock && stock <= minThreshold;

	return (
		<View className="flex-1 bg-white dark:bg-zinc-950">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					padding: 16,
					paddingBottom: insets.bottom + 40,
				}}
				showsVerticalScrollIndicator={false}
			>
				{/* 1. HERO PRODUCT CARD */}
				<View className="relative mb-4 items-center rounded-2xl border border-slate-100 bg-slate-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900">
					{/* Quick Edit Icon */}
					<Pressable
						onPress={() =>
							router.push({
								pathname: "/stock/(product)/create" as any,
								params: { id: product._id },
							})
						}
						className="absolute top-3 right-3 flex-row items-center rounded-xl bg-accent/10 px-3 py-1.5"
					>
						<Ionicons name="create-outline" size={16} color={themeAccent} />
						<Text className="ml-1 font-bold text-accent text-xs">Edit</Text>
					</Pressable>

					{product.image ? (
						<Image
							source={{ uri: product.image }}
							className="h-32 w-32 rounded-2xl bg-white"
							resizeMode="contain"
						/>
					) : (
						<View className="h-24 w-24 items-center justify-center rounded-2xl bg-accent/10">
							<Ionicons name="wine" size={44} color={themeAccent} />
						</View>
					)}

					<Text className="mt-3 font-extrabold text-lg text-slate-900 dark:text-white">
						{product.name}
					</Text>
					<Text className="mt-0.5 font-medium text-slate-400 text-xs">
						SKU: {product.sku} • {product.category || "Beverages"}
					</Text>
					<Text className="mt-0.5 text-slate-500 text-xs">
						Pack: {product.packSize} • {product.unitsPerCase} {product.unit}s
						per case
					</Text>
				</View>

				{/* 2. LIVE STOCK SNAPSHOT */}
				<View className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold text-slate-400 text-xs">
							CURRENT WAREHOUSE STOCK
						</Text>
						<View
							className={`rounded-full px-2.5 py-0.5 ${
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

					<Text className="mt-2 font-black text-3xl text-slate-900 dark:text-white">
						{stock} pcs
					</Text>
					<Text className="mt-0.5 text-slate-500 text-xs">
						{product.stockDisplay ||
							`${Math.floor(stock / product.unitsPerCase)} cases + ${stock % product.unitsPerCase} units`}
					</Text>
				</View>

				{/* 3. PRICING & MARGIN */}
				<View className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Text className="mb-3 font-bold text-slate-400 text-xs">
						PRICING & PROFIT MARGIN
					</Text>
					<View className="flex-row gap-3">
						<View className="flex-1 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
							<Text className="font-semibold text-[10px] text-slate-400">
								PURCHASE (COST)
							</Text>
							<Text className="mt-1 font-bold text-slate-900 text-xl dark:text-white">
								₹{product.purchaseRate || 0}
							</Text>
							<Text className="text-[10px] text-slate-400">per item</Text>
						</View>

						<View className="flex-1 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
							<Text className="font-semibold text-[10px] text-slate-400">
								SELLING (RETAIL)
							</Text>
							<Text className="mt-1 font-bold text-emerald-600 text-xl dark:text-emerald-400">
								₹{product.sellingRate || 0}
							</Text>
							<Text className="text-[10px] text-emerald-600">per item</Text>
						</View>
					</View>

					{product.purchaseRate > 0 && product.sellingRate > 0 && (
						<View className="mt-3 flex-row items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2 dark:bg-emerald-950/30">
							<Text className="font-semibold text-emerald-700 text-xs dark:text-emerald-400">
								Gross Margin: +₹{marginPerUnit.toFixed(2)} (+
								{marginPercent.toFixed(1)}%)
							</Text>
							<Ionicons name="trending-up" size={16} color="#059669" />
						</View>
					)}
				</View>

				{/* 4. GST & SETTINGS */}
				<View className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Text className="mb-3 font-bold text-slate-400 text-xs">
						TAX & SETTINGS
					</Text>
					<View className="gap-2">
						<View className="flex-row items-center justify-between py-1">
							<Text className="text-slate-500 text-xs">GST Rate</Text>
							<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
								{product.gstRate || 0}% (CGST {product.cgst || 0}% + SGST{" "}
								{product.sgst || 0}%)
							</Text>
						</View>
						<View className="h-px bg-slate-100 dark:bg-zinc-800" />
						<View className="flex-row items-center justify-between py-1">
							<Text className="text-slate-500 text-xs">
								Min. Reorder Threshold
							</Text>
							<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
								{product.minimumStock || 0} cases
							</Text>
						</View>
					</View>
				</View>

				{/* 5. ACTION BUTTONS */}
				<View className="gap-2.5">
					<Pressable
						onPress={() => router.push("/stock/entry" as any)}
						className="flex-row items-center justify-center rounded-2xl bg-accent py-3.5 active:opacity-90"
					>
						<Ionicons name="add-circle" size={18} color="#ffffff" />
						<Text className="ml-2 font-bold text-accent-foreground text-sm">
							+ Add / Purchase Stock
						</Text>
					</Pressable>

					<Pressable
						onPress={() =>
							router.push({
								pathname: "/stock/(product)/create" as any,
								params: { id: product._id },
							})
						}
						className="flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
					>
						<Ionicons
							name="create-outline"
							size={18}
							color={themeColorForeground}
						/>
						<Text className="ml-2 font-bold text-slate-800 text-sm dark:text-zinc-200">
							Edit Product Master
						</Text>
					</Pressable>
				</View>
			</ScrollView>
		</View>
	);
}
