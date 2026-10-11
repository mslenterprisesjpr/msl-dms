import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	Button,
	Card,
	Chip,
	Input,
	TextField,
	Typography,
} from "heroui-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Alert,
	FlatList,
	Image,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import { useDeleteProduct, useProducts } from "@/hooks/queries/use-products";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import type { Product } from "@/services/product.service";

type FilterType = "all" | "in_stock" | "low_stock" | "inactive";

interface ProductCardProps {
	product: Product;
	onPress: (product: Product) => void;
	onDelete: (product: Product) => void;
}

const ProductCard = React.memo(function ProductCard({
	product,
	onPress,
	onDelete,
}: ProductCardProps) {
	const isLowStock =
		product.stockInCases !== undefined &&
		product.minimumStock !== undefined &&
		product.stockInCases <= product.minimumStock;

	// Spec tag string e.g. "Beverages • 200ml • BOTTLE"
	const specs = [product.category, product.packSize, product.unit]
		.filter(Boolean)
		.join(" • ");

	return (
		<Card className="mb-2.5 overflow-hidden border border-border/60 bg-surface">
			<View className="p-3">
				{/* Top Row: Thumbnail + Info + Pricing */}
				<View className="flex-row items-center gap-3">
					{/* Product Image Thumbnail */}
					<Pressable
						onPress={() => onPress(product)}
						className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-default active:opacity-75"
					>
						{product.image ? (
							<Image
								source={{ uri: product.image }}
								style={{ width: "100%", height: "100%" }}
								resizeMode="cover"
							/>
						) : (
							<Ionicons
								name="cube-outline"
								size={26}
								className="text-foreground/30"
							/>
						)}
					</Pressable>

					{/* Title, Specs & SKU */}
					<Pressable
						onPress={() => onPress(product)}
						className="flex-1 justify-center active:opacity-75"
					>
						<Typography
							type="body"
							weight="semibold"
							className="text-[15px] text-foreground"
							numberOfLines={1}
						>
							{product.name}
						</Typography>

						{specs ? (
							<Typography
								type="body-xs"
								color="muted"
								className="mt-0.5 text-[12px] text-foreground/60"
								numberOfLines={1}
							>
								{specs}
							</Typography>
						) : null}

						<Typography
							type="body-xs"
							className="mt-0.5 text-[11px] text-foreground/40"
							numberOfLines={1}
						>
							SKU: {product.sku}
						</Typography>
					</Pressable>

					{/* Price Block (Top Right) */}
					<View className="items-end justify-center pl-1">
						<Typography
							type="body"
							weight="bold"
							className="text-[16px] text-accent"
						>
							₹{product.sellingRate?.toLocaleString("en-IN") ?? 0}
						</Typography>
						{product.purchaseRate !== undefined && (
							<Typography
								type="body-xs"
								color="muted"
								className="mt-0.5 text-[11px] text-foreground/45"
							>
								Buy: ₹{product.purchaseRate?.toLocaleString("en-IN") ?? 0}
							</Typography>
						)}
					</View>
				</View>

				{/* Bottom Row: Stock Badge & Action Buttons */}
				<View className="mt-2.5 flex-row items-center justify-between border-border/40 border-t pt-2">
					{/* Stock & Status Badges */}
					<View className="mr-2 flex-1 flex-row flex-wrap items-center gap-1.5">
						{/* Available Stock Pill */}
						<View
							className={`flex-row items-center gap-1 rounded-md border px-2 py-0.5 ${
								isLowStock
									? "border-danger/40 bg-danger/10"
									: "border-border/60 bg-default/70"
							}`}
						>
							<Ionicons
								name={isLowStock ? "alert-circle" : "cube"}
								size={12}
								className={isLowStock ? "text-danger" : "text-foreground/60"}
							/>
							<Typography
								type="body-xs"
								weight="medium"
								className={`text-[12px] ${
									isLowStock
										? "font-semibold text-danger"
										: "text-foreground/80"
								}`}
							>
								{product.stockDisplay || `${product.stock ?? 0} units`}
							</Typography>
						</View>

						{/* Inactive Badge */}
						{!product.isActive && (
							<View className="rounded-md border border-danger/30 bg-danger/10 px-1.5 py-0.5">
								<Typography
									type="body-xs"
									weight="medium"
									className="text-[11px] text-danger"
								>
									Inactive
								</Typography>
							</View>
						)}
					</View>

					{/* Actions (Pencil & Trash) */}
					<View className="flex-row items-center gap-1.5">
						<Pressable
							onPress={() => onPress(product)}
							className="h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-default active:opacity-70"
							hitSlop={8}
						>
							<Ionicons
								name="pencil"
								size={13}
								className="text-foreground/75"
							/>
						</Pressable>
						<Pressable
							onPress={() => onDelete(product)}
							className="h-7 w-7 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 active:opacity-70"
							hitSlop={8}
						>
							<Ionicons
								name="trash-outline"
								size={13}
								className="text-danger"
							/>
						</Pressable>
					</View>
				</View>
			</View>
		</Card>
	);
});

export default function ProductsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search.trim());
		}, 300);
		return () => clearTimeout(timer);
	}, [search]);

	// Session & Organization state
	const { data: session } = authClient.useSession();
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const organizations = useOrganizationStore((state) => state.organizations);
	const currentOrg =
		organizations.find((org) => org.id === currentOrgId) || null;

	// Query products
	const { data, isLoading, isRefetching, error, refetch } = useProducts(
		{
			page: 1,
			limit: 100,
			search: debouncedSearch || undefined,
		},
		{
			enabled: !!session && !!currentOrg,
		},
	);

	const deleteMutation = useDeleteProduct();

	// Handlers
	const handleEdit = useCallback(
		(product: Product) => {
			router.push(`/(drawer)/(tabs)/products/${product._id}`);
		},
		[router],
	);

	const handleDelete = useCallback(
		(product: Product) => {
			Alert.alert(
				"Delete Product",
				`Are you sure you want to delete "${product.name}"?`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Delete",
						style: "destructive",
						onPress: async () => {
							try {
								await deleteMutation.mutateAsync(product._id);
								Alert.alert("Success", "Product deleted successfully");
							} catch (err: any) {
								Alert.alert("Error", err.message || "Failed to delete product");
							}
						},
					},
				],
			);
		},
		[deleteMutation],
	);

	// Client-side quick filter
	const filteredProducts = useMemo(() => {
		if (!data?.data) return [];
		let list = data.data;

		if (selectedFilter === "low_stock") {
			list = list.filter(
				(p) =>
					p.stockInCases !== undefined &&
					p.minimumStock !== undefined &&
					p.stockInCases <= p.minimumStock,
			);
		} else if (selectedFilter === "in_stock") {
			list = list.filter(
				(p) =>
					(p.stock !== undefined && p.stock > 0) ||
					(p.stockInCases !== undefined && p.stockInCases > 0),
			);
		} else if (selectedFilter === "inactive") {
			list = list.filter((p) => !p.isActive);
		}

		return list;
	}, [data?.data, selectedFilter]);

	const keyExtractor = useCallback((item: Product) => item._id, []);

	const renderProduct = useCallback(
		({ item }: { item: Product }) => (
			<ProductCard
				product={item}
				onPress={handleEdit}
				onDelete={handleDelete}
			/>
		),
		[handleEdit, handleDelete],
	);

	// Check if user is logged in
	if (!session) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Ionicons name="lock-closed" size={48} className="text-foreground/30" />
				<Typography type="h2" className="mt-4 mb-2 font-bold text-foreground">
					Please Login
				</Typography>
				<Typography
					type="body"
					color="muted"
					className="mb-4 text-center text-foreground/60"
				>
					You need to be logged in to view products
				</Typography>
			</Container>
		);
	}

	// Check if organization is selected
	if (!currentOrg) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Ionicons name="business" size={48} className="text-foreground/30" />
				<Typography type="h2" className="mt-4 mb-2 font-bold text-foreground">
					Select Organization
				</Typography>
				<Typography
					type="body"
					color="muted"
					className="mb-4 text-center text-foreground/60"
				>
					Please select an organization to view products
				</Typography>
				<Button
					variant="primary"
					onPress={() => router.push("/(drawer)/(tabs)/organizations")}
				>
					Go to Organizations
				</Button>
			</Container>
		);
	}

	if (isLoading && !isRefetching) {
		return <LoadingScreen message="Loading products..." />;
	}

	if (error) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Ionicons name="alert-circle" size={48} className="text-danger" />
				<Typography type="h2" className="mt-4 mb-2 font-bold text-danger">
					Error
				</Typography>
				<Typography
					type="body"
					color="muted"
					className="mb-4 text-center text-foreground/60"
				>
					{error.message}
				</Typography>
				<Button variant="primary" onPress={() => refetch()}>
					Try Again
				</Button>
			</Container>
		);
	}

	const FILTER_TABS: Array<{
		id: FilterType;
		label: string;
		icon: keyof typeof Ionicons.glyphMap;
	}> = [
		{ id: "all", label: "All", icon: "cube-outline" },
		{ id: "in_stock", label: "In Stock", icon: "checkmark-circle-outline" },
		{ id: "low_stock", label: "Low Stock", icon: "alert-circle-outline" },
		{ id: "inactive", label: "Inactive", icon: "pause-circle-outline" },
	];

	return (
		<Container className="flex-1" isScrollable={false}>
			{/* Top Header */}
			<View
				className="border-border border-b bg-surface px-4 pb-3"
				style={{ paddingTop: insets.top + 12 }}
			>
				{/* Title and Action Buttons */}
				<View className="mb-3 flex-row items-center justify-between">
					<View>
						<Typography type="h1" className="font-bold text-foreground">
							Products
						</Typography>
						{data?.pagination && (
							<Typography type="body-xs" color="muted" className="mt-0.5">
								{filteredProducts.length}{" "}
								{filteredProducts.length === 1 ? "item" : "items"}
								{selectedFilter !== "all" || debouncedSearch
									? " shown"
									: ` of ${data.pagination.total}`}
							</Typography>
						)}
					</View>

					<View className="flex-row items-center gap-2">
						<Button
							size="sm"
							variant="secondary"
							className="border border-border/70"
							onPress={() =>
								router.push("/(drawer)/(tabs)/products/stock-history")
							}
						>
							<Ionicons
								name="time-outline"
								size={17}
								className="text-foreground"
							/>
						</Button>
						<Button
							size="sm"
							variant="secondary"
							className="border border-border/70"
							onPress={() =>
								router.push("/(drawer)/(tabs)/products/stock-entry")
							}
						>
							<Ionicons
								name="cube-outline"
								size={17}
								className="text-foreground"
							/>
						</Button>
						<Button
							size="sm"
							variant="primary"
							onPress={() => router.push("/(drawer)/(tabs)/products/create")}
						>
							<Ionicons name="add" size={19} />
						</Button>
					</View>
				</View>

				{/* Search Bar */}
				<View className="flex-row items-center gap-2">
					<View className="flex-1">
						<TextField>
							<Input
								placeholder="Search products by name or SKU..."
								value={search}
								onChangeText={setSearch}
								returnKeyType="search"
							/>
						</TextField>
					</View>
					{search.length > 0 && (
						<Button size="sm" variant="secondary" onPress={() => setSearch("")}>
							<Ionicons name="close" size={18} />
						</Button>
					)}
				</View>

				{/* Filter Pills */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: 8 }}
					className="mt-2.5"
				>
					{FILTER_TABS.map((tab) => {
						const isSelected = selectedFilter === tab.id;
						return (
							<Pressable
								key={tab.id}
								onPress={() => setSelectedFilter(tab.id)}
								className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
									isSelected
										? "border-accent bg-accent"
										: "border-border bg-default"
								}`}
							>
								<Ionicons
									name={tab.icon}
									size={14}
									className={
										isSelected ? "text-accent-foreground" : "text-foreground/60"
									}
								/>
								<Typography
									type="body-xs"
									weight={isSelected ? "semibold" : "normal"}
									className={
										isSelected
											? "font-semibold text-accent-foreground"
											: "text-foreground/70"
									}
								>
									{tab.label}
								</Typography>
							</Pressable>
						);
					})}
				</ScrollView>
			</View>

			{/* Products List */}
			<FlatList
				data={filteredProducts}
				renderItem={renderProduct}
				keyExtractor={keyExtractor}
				contentContainerStyle={{
					padding: 16,
					paddingBottom: 24,
				}}
				showsVerticalScrollIndicator={false}
				initialNumToRender={8}
				maxToRenderPerBatch={10}
				windowSize={7}
				removeClippedSubviews={Platform.OS === "android"}
				refreshControl={
					<RefreshControl refreshing={isRefetching} onRefresh={refetch} />
				}
				ListEmptyComponent={
					<View className="items-center justify-center py-16">
						<Ionicons
							name={debouncedSearch ? "search-outline" : "cube-outline"}
							size={56}
							className="text-foreground/20"
						/>
						<Typography
							type="h3"
							className="mt-3 text-center font-semibold text-foreground"
						>
							{debouncedSearch
								? "No matching products"
								: selectedFilter !== "all"
									? `No ${selectedFilter.replace("_", " ")} products`
									: "No products found"}
						</Typography>
						<Typography
							type="body-sm"
							color="muted"
							className="mt-1 text-center text-foreground/60"
						>
							{debouncedSearch
								? `No products found for "${debouncedSearch}". Try another search term.`
								: selectedFilter !== "all"
									? "Try choosing another filter or view all products."
									: "Create your first product to get started."}
						</Typography>
						{debouncedSearch ? (
							<Button
								variant="outline"
								className="mt-4"
								onPress={() => setSearch("")}
							>
								Clear Search
							</Button>
						) : selectedFilter !== "all" ? (
							<Button
								variant="outline"
								className="mt-4"
								onPress={() => setSelectedFilter("all")}
							>
								View All Products
							</Button>
						) : (
							<Button
								variant="primary"
								className="mt-4"
								onPress={() => router.push("/(drawer)/(tabs)/products/create")}
							>
								Create your first product
							</Button>
						)}
					</View>
				}
			/>
		</Container>
	);
}
