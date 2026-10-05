import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, Card, Chip, Typography } from "heroui-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import { useStockTransactions } from "@/hooks/queries/use-stock";
import { authClient } from "@/lib/auth-client";
import type { StockTransaction } from "@/services/stock.service";

export default function WorkerStockHistoryScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [refreshing, setRefreshing] = useState(false);

	const { data: session } = authClient.useSession();

	// Fetch stock transactions (will show only worker's transactions)
	const { data, isLoading, error, refetch } = useStockTransactions(
		{ page: 1, limit: 50 },
		{ enabled: !!session },
	);

	const handleRefresh = async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	};

	const renderTransaction = ({ item }: { item: StockTransaction }) => {
		const isAddition = item.type === "ISSUE";
		const isReturn = item.type === "RETURN";
		const color = isAddition
			? "text-success"
			: isReturn
				? "text-warning"
				: "text-danger";

		// Handle populated productId
		const product = typeof item.productId === "object" ? item.productId : null;
		const productName = product?.name || "Unknown Product";

		return (
			<Card className="mb-3 p-4">
				<View className="mb-2 flex-row items-center justify-between">
					<View className="flex-row items-center">
						<Ionicons
							name={
								isAddition
									? "arrow-down-circle"
									: isReturn
										? "arrow-undo-circle"
										: "arrow-up-circle"
							}
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
						{isAddition ? "+" : isReturn ? "↩" : "-"}{" "}
						{item.quantityDisplay || `${item.quantity} Units`}
					</Typography>

					{(item.cases > 0 || item.units > 0) && (
						<Chip size="sm" variant="secondary">
							{item.cases} Cases + {item.units} Units
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

	if (isLoading && !refreshing) {
		return (
			<LoadingScreen
				message="Loading history..."
				subtitle="Fetching your stock transactions"
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
					Error Loading History
				</Typography>
				<Typography
					variant="body"
					className="mb-4 text-center text-foreground/60"
				>
					{error?.message || "Failed to load transactions"}
				</Typography>
				<Button onPress={() => refetch()}>Try Again</Button>
			</SafeAreaView>
		);
	}

	const transactions = data?.data || [];

	return (
		<Container className="flex-1" isScrollable={false}>
			<View
				className="border-border border-b bg-surface p-4"
				style={{ paddingTop: insets.top + 16 }}
			>
				<View className="flex-row items-center gap-3">
					<Button size="sm" variant="outline" onPress={() => router.back()}>
						← Back
					</Button>
					<Typography variant="title1" className="text-foreground">
						Stock History
					</Typography>
				</View>
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
							name="time-outline"
							size={64}
							className="text-foreground/20"
						/>
						<Typography variant="body" className="mt-4 text-foreground/60">
							No transactions yet
						</Typography>
					</View>
				}
			/>
		</Container>
	);
}
