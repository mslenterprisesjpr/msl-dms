import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	Button,
	Card,
	Chip,
	Input,
	Spinner,
	TextField,
	Typography,
} from "heroui-native";
import React, { useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { Container } from "@/components/container";
import { useDeleteProduct, useProducts } from "@/hooks/queries/use-products";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import type { Product } from "@/services/product.service";

export default function ProductsScreen() {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);

	// Check if user is logged in
	const { data: session } = authClient.useSession();
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const organizations = useOrganizationStore((state) => state.organizations);

	// Get current org
	const currentOrg =
		organizations.find((org) => org.id === currentOrgId) || null;

	// Fetch products with search filter
	const { data, isLoading, error, refetch } = useProducts(
		{
			page: 1,
			limit: 50,
			isActive: true,
			search: search || undefined,
		},
		{
			enabled: !!session && !!currentOrg,
		},
	);

	const deleteMutation = useDeleteProduct();

	const handleRefresh = async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	};

	const handleDelete = (product: Product) => {
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
						} catch (error: any) {
							Alert.alert("Error", error.message || "Failed to delete product");
						}
					},
				},
			],
		);
	};

	const renderProduct = ({ item }: { item: Product }) => (
		<Card className="mb-3">
			<View className="flex-row items-start justify-between">
				<View className="flex-1 pr-2">
					<Typography variant="title3" className="mb-1 text-foreground">
						{item.name}
					</Typography>
					<Typography variant="caption" className="mb-2 text-foreground/50">
						SKU: {item.sku}
					</Typography>

					<View className="mb-2 flex-row flex-wrap items-center gap-2">
						{item.category && (
							<Chip size="sm" variant="secondary">
								{item.category}
							</Chip>
						)}
						<Chip size="sm" variant="accent">
							{item.packSize}
						</Chip>
						<Chip size="sm" variant="default">
							{item.unit}
						</Chip>
					</View>

					<View className="mb-2 gap-1">
						<Typography variant="caption" className="text-foreground/60">
							Purchase: ₹{item.purchaseRate} | Selling: ₹{item.sellingRate}
						</Typography>
						<Typography variant="caption" className="text-accent">
							Stock: {item.stockDisplay || `${item.stock} units`}
						</Typography>
					</View>

					{item.stockInCases !== undefined &&
						item.stockInCases <= item.minimumStock && (
							<Chip size="sm" variant="danger">
								⚠️ Low Stock
							</Chip>
						)}
				</View>

				<View className="gap-2">
					<Button
						size="sm"
						variant="secondary"
						onPress={() => router.push(`/(drawer)/(tabs)/products/${item._id}`)}
					>
						<Ionicons name="pencil" size={16} />
					</Button>
					<Button size="sm" variant="danger" onPress={() => handleDelete(item)}>
						<Ionicons name="trash" size={16} />
					</Button>
				</View>
			</View>
		</Card>
	);

	// Check if user is logged in
	if (!session) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Ionicons name="lock-closed" size={48} className="text-foreground/30" />
				<Typography variant="title2" className="mt-4 mb-2 text-foreground">
					Please Login
				</Typography>
				<Typography variant="body" className="mb-4 text-center text-foreground/60">
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
				<Typography variant="title2" className="mt-4 mb-2 text-foreground">
					Select Organization
				</Typography>
				<Typography variant="body" className="mb-4 text-center text-foreground/60">
					Please select an organization to view products
				</Typography>
				<Button onPress={() => router.push("/(drawer)/(tabs)/organizations")}>
					Go to Organizations
				</Button>
			</Container>
		);
	}

	if (isLoading && !refreshing) {
		return (
			<Container className="flex-1 items-center justify-center">
				<Spinner size="lg" />
				<Typography variant="body" className="mt-4 text-foreground">
					Loading products...
				</Typography>
			</Container>
		);
	}

	if (error) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Ionicons name="alert-circle" size={48} className="text-danger" />
				<Typography variant="title2" className="mt-4 mb-2 text-danger">
					Error
				</Typography>
				<Typography variant="body" className="mb-4 text-center text-foreground/60">
					{error.message}
				</Typography>
				<Button onPress={() => refetch()}>Try Again</Button>
			</Container>
		);
	}

	return (
		<Container className="flex-1" isScrollable={false}>
			{/* Header */}
			<View className="border-border border-b bg-surface p-4">
				<View className="mb-3 flex-row items-center justify-between">
					<Typography variant="title1" className="text-foreground">
						Products
					</Typography>
					<View className="flex-row gap-2">
						<Button
							size="sm"
							variant="secondary"
							onPress={() => router.push("/(drawer)/(tabs)/products/stock-history")}
						>
							<Ionicons name="list" size={18} />
						</Button>
						<Button
							size="sm"
							variant="accent"
							onPress={() => router.push("/(drawer)/(tabs)/products/stock-entry")}
						>
							<Ionicons name="cube" size={18} />
						</Button>
						<Button
							size="sm"
							onPress={() => router.push("/(drawer)/(tabs)/products/create")}
						>
							<Ionicons name="add" size={18} />
						</Button>
					</View>
				</View>

				<TextField>
					<Input
						placeholder="Search products by name or SKU..."
						value={search}
						onChangeText={setSearch}
					/>
				</TextField>

				{data?.pagination && (
					<Typography variant="caption" className="mt-2 text-foreground/60">
						Showing {data.data.length} of {data.pagination.total} products
					</Typography>
				)}
			</View>

			{/* List */}
			<FlatList
				data={data?.data || []}
				renderItem={renderProduct}
				keyExtractor={(item) => item._id}
				contentContainerStyle={{ padding: 16 }}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
				}
				ListEmptyComponent={
					<View className="items-center justify-center py-12">
						<Ionicons name="cube-outline" size={64} className="text-foreground/20" />
						<Typography variant="body" className="mt-4 text-foreground/60">
							No products found
						</Typography>
						<Button
							variant="outline"
							className="mt-4"
							onPress={() => router.push("/(drawer)/(tabs)/products/create")}
						>
							Create your first product
						</Button>
					</View>
				}
			/>
		</Container>
	);
}
