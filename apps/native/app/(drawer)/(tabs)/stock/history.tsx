import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, Card, Chip } from "heroui-native";
import React, { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import { useStockTransactions } from "@/hooks/queries/use-stock";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import type { StockTransaction } from "@/services/stock.service";

export default function StockHistoryScreen() {
	const router = useRouter();
	const [refreshing, setRefreshing] = useState(false);

	const { data: session } = authClient.useSession();
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const organizations = useOrganizationStore((state) => state.organizations);
	const currentOrg =
		organizations.find((org) => org.id === currentOrgId) || null;

	const { data, isLoading, error, refetch } = useStockTransactions(
		{ page: 1, limit: 20 },
		{ enabled: !!session && !!currentOrg },
	);

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} catch (err) {
			console.error("Refresh error:", err);
		} finally {
			setRefreshing(false);
		}
	};

	const transactions = data?.data || [];

	const getTransactionColor = (type: string) => {
		switch (type) {
			case "PURCHASE":
			case "RETURN":
				return "text-success";
			case "SALE":
			case "ISSUE":
				return "text-warning";
			case "ADJUSTMENT":
				return "text-primary";
			default:
				return "text-foreground";
		}
	};

	const renderTransaction = ({ item }: { item: StockTransaction }) => {
		const isAddition = item.type === "PURCHASE" || item.type === "RETURN";
		const color = getTransactionColor(item.type);
		const itemAny = item as any;
		const productIdStr =
			typeof itemAny.productId === "string"
				? itemAny.productId
				: itemAny.productId?._id || item._id;
		const productName =
			typeof itemAny.product === "object"
				? itemAny.product?.name
				: itemAny.productName || `Product #${productIdStr.slice(-4)}`;
		const product =
			typeof itemAny.product === "object" ? itemAny.product : null;

		return (
			<Card className="mb-3 p-4">
				<View className="mb-2 flex-row items-center justify-between">
					<View className="flex-row items-center">
						<Ionicons
							name={isAddition ? "arrow-down-circle" : "arrow-up-circle"}
							size={20}
							className={color}
						/>
						<Text className="ml-2 font-bold text-base text-foreground">
							{item.type}
						</Text>
					</View>
					<Text className="text-foreground/50 text-xs">
						{new Date(item.createdAt).toLocaleDateString()}
					</Text>
				</View>

				<Text className="mb-1 font-semibold text-foreground text-sm">
					{productName}
				</Text>
				{product?.sku && (
					<Text className="mb-2 text-foreground/50 text-xs">
						SKU: {product.sku}
					</Text>
				)}

				<View className="mt-2 flex-row items-center justify-between">
					<Text className={`${color} font-semibold text-sm`}>
						{isAddition ? "+" : "-"}{" "}
						{item.quantityDisplay || `${item.quantity} Units`}
					</Text>

					{(item.cases > 0 || item.units > 0) && (
						<Chip size="sm" variant="secondary">
							{item.cases} Cases + {item.units} Loose
						</Chip>
					)}
				</View>

				{item.note && (
					<Text className="mt-2 text-foreground/60 text-xs italic">
						Note: {item.note}
					</Text>
				)}
			</Card>
		);
	};

	if (!session) {
		return (
			<SafeAreaView
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: "#000",
					padding: 24,
				}}
			>
				<Text className="mt-4 mb-2 font-bold text-foreground text-lg">
					Please Login
				</Text>
			</SafeAreaView>
		);
	}

	if (!currentOrg) {
		return (
			<SafeAreaView
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: "#000",
					padding: 24,
				}}
			>
				<Text className="font-bold text-foreground text-lg">
					Select Organization
				</Text>
				<Button onPress={() => router.push("/(drawer)/(tabs)/organizations")}>
					Go to Organizations
				</Button>
			</SafeAreaView>
		);
	}

	if (isLoading && !refreshing) {
		return (
			<LoadingScreen
				message="Loading stock history..."
				subtitle="Fetching all stock transactions"
			/>
		);
	}

	if (error) {
		return (
			<SafeAreaView
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: "#000",
					padding: 24,
				}}
			>
				<Ionicons name="alert-circle" size={48} className="text-danger" />
				<Text className="mt-4 mb-2 font-bold text-danger text-lg">
					Error Loading Stock History
				</Text>
				<Text className="mb-4 text-center text-foreground/60 text-sm">
					{error?.message || "Failed to load stock transactions"}
				</Text>
				<Button onPress={() => refetch()}>Try Again</Button>
			</SafeAreaView>
		);
	}

	return (
		<Container className="flex-1" isScrollable={false}>
			<FlatList
				data={transactions}
				renderItem={renderTransaction}
				keyExtractor={(item) => item._id}
				contentContainerStyle={{ padding: 16 }}
				ListHeaderComponent={
					<View className="mb-3 flex-row items-center justify-between">
						<Text className="font-semibold text-slate-500 text-xs uppercase tracking-wider dark:text-zinc-400">
							Recent Stock Activity
						</Text>
						<Pressable
							onPress={() => router.push("/stock/entry" as any)}
							className="flex-row items-center rounded-lg bg-accent px-3 py-1.5 shadow-sm active:opacity-90"
						>
							<Ionicons name="add" size={16} color="#ffffff" />
							<Text className="ml-1 font-bold text-accent-foreground text-xs">
								New Entry
							</Text>
						</Pressable>
					</View>
				}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
				}
				ListEmptyComponent={
					<View className="items-center justify-center py-12">
						<Ionicons
							name="cube-outline"
							size={64}
							className="text-foreground/20"
						/>
						<Text className="mt-4 font-medium text-foreground/60 text-sm">
							No stock transactions yet
						</Text>
						<Text className="mt-2 text-foreground/50 text-xs">
							Add stock using the Entry button above
						</Text>
					</View>
				}
			/>
		</Container>
	);
}
