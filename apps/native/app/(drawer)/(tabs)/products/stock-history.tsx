import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, Card, Chip, Typography } from "heroui-native";
import React, { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import { useStockTransactions } from "@/hooks/queries/use-stock";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import type { StockTransaction } from "@/services/stock.service";

export default function StockScreen() {
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

	// Debug logging
	React.useEffect(() => {
		console.log("📊 Stock History Debug:", {
			hasSession: !!session,
			hasOrg: !!currentOrg,
			orgId: currentOrgId,
			isLoading,
			hasData: !!data,
			dataCount: data?.data?.length || 0,
			error: error?.message,
		});
	}, [session, currentOrg, currentOrgId, isLoading, data, error]);

	const handleRefresh = async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	};

	// Flatten paginated data
	const transactions = data?.data || [];

	const renderTransaction = ({ item }: { item: StockTransaction }) => {
		const isAddition = item.type === "PURCHASE" || item.type === "RETURN";
		const color = isAddition ? "text-success" : "text-danger";

		// Handle populated productId (can be object or string)
		const product = typeof item.productId === "object" ? item.productId : null;
		const productName = product?.name || "Unknown Product";
		const _productId =
			typeof item.productId === "string"
				? item.productId
				: product?.id || item.productId?._id;

		return (
			<Card className="mb-3 p-4">
				<View className="mb-2 flex-row items-center justify-between">
					<View className="flex-row items-center">
						<Ionicons
							name={isAddition ? "arrow-down-circle" : "arrow-up-circle"}
							size={20}
							className={color}
						/>
						<Typography
							variant="body"
							className="ml-2 font-bold text-foreground"
						>
							{item.type}
						</Typography>
					</View>
					<Typography variant="caption" className="text-foreground/50">
						{new Date(item.createdAt).toLocaleDateString()}
					</Typography>
				</View>

				<Typography variant="title3" className="mb-1 text-foreground">
					{productName}
				</Typography>
				{product?.sku && (
					<Typography variant="caption" className="mb-2 text-foreground/50">
						SKU: {product.sku}
					</Typography>
				)}

				<View className="mt-2 flex-row items-center justify-between">
					<Typography variant="body" className={`${color} font-semibold`}>
						{isAddition ? "+" : "-"}{" "}
						{item.quantityDisplay || `${item.quantity} Units`}
					</Typography>

					{(item.cases > 0 || item.units > 0) && (
						<Chip size="sm" variant="secondary">
							{item.cases} Cases + {item.units} Loose
						</Chip>
					)}
				</View>

				{item.note && (
					<Typography
						variant="caption"
						className="mt-2 text-foreground/60 italic"
					>
						Note: {item.note}
					</Typography>
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
				<Ionicons name="lock-closed" size={48} className="text-foreground/30" />
				<Typography variant="title2" className="mt-4 mb-2 text-foreground">
					Please Login
				</Typography>
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
				<Typography variant="title2" className="text-foreground">
					Select Organization
				</Typography>
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
				<Typography variant="title2" className="mt-4 mb-2 text-danger">
					Error Loading Stock History
				</Typography>
				<Typography
					variant="body"
					className="mb-4 text-center text-foreground/60"
				>
					{error?.message || "Failed to load stock transactions"}
				</Typography>
				<Button onPress={() => refetch()}>Try Again</Button>
			</SafeAreaView>
		);
	}

	return (
		<Container className="flex-1" isScrollable={false}>
			<View className="flex-row items-center justify-between border-border border-b bg-surface p-4">
				<Typography variant="title1" className="text-foreground">
					Stock History
				</Typography>
				<Button
					size="sm"
					onPress={() => router.push("/(drawer)/(tabs)/products/stock-entry")}
				>
					<Ionicons name="add" size={18} />
					<Typography variant="caption" className="ml-1">
						Entry
					</Typography>
				</Button>
			</View>

			<FlatList
				data={transactions}
				renderItem={renderTransaction}
				keyExtractor={(item) => item._id}
				contentContainerStyle={{ padding: 16 }}
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
						<Typography variant="body" className="mt-4 text-foreground/60">
							No stock transactions yet
						</Typography>
						<Typography variant="caption" className="mt-2 text-foreground/50">
							Add stock using the Entry button above
						</Typography>
					</View>
				}
			/>
		</Container>
	);
}
