import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, Card, Chip, Typography } from "heroui-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import type { WorkerStock } from "@/hooks/queries/use-worker-stock";
import { useAllWorkersStock } from "@/hooks/queries/use-worker-stock";

export default function AllWorkersStockScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [refreshing, setRefreshing] = useState(false);

	const { data: stockData, isLoading, error, refetch } = useAllWorkersStock();

	const handleRefresh = async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	};

	// Group stock by worker
	const groupedByWorker = (stockData?.data || []).reduce(
		(acc, item) => {
			const workerId = item.workerId;
			if (!acc[workerId]) {
				acc[workerId] = [];
			}
			acc[workerId].push(item);
			return acc;
		},
		{} as Record<string, WorkerStock[]>,
	);

	const workerIds = Object.keys(groupedByWorker);

	const renderWorkerStock = ({ item: workerId }: { item: string }) => {
		const stocks = groupedByWorker[workerId];
		const totalValue = stocks.reduce(
			(sum, stock) => sum + stock.stock * (stock.productId.sellingRate || 0),
			0,
		);

		return (
			<Card className="mb-3">
				<View className="p-4">
					<View className="mb-3 flex-row items-center justify-between">
						<View className="flex-1">
							<Typography variant="title3" className="text-foreground">
								Worker: {workerId}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								{stocks.length} products | ₹{totalValue.toFixed(2)} value
							</Typography>
						</View>
						<Button
							size="sm"
							variant="outline"
							onPress={() => {
								// Navigate to worker detail (can create later)
							}}
						>
							<Ionicons name="eye" size={16} />
						</Button>
					</View>

					{/* Products List */}
					<View className="gap-2 border-border border-t pt-3">
						{stocks.map((stock) => (
							<View
								key={stock._id}
								className="flex-row items-center justify-between"
							>
								<View className="flex-1">
									<Typography variant="body" className="text-foreground">
										{stock.productId.name}
									</Typography>
									<Typography variant="caption" className="text-foreground/50">
										{stock.stockDisplay || `${stock.stock} units`}
									</Typography>
								</View>
								<Chip size="sm" variant="accent">
									{stock.stock} units
								</Chip>
							</View>
						))}
					</View>
				</View>
			</Card>
		);
	};

	if (isLoading && !refreshing) {
		return (
			<LoadingScreen
				message="Loading all workers stock..."
				subtitle="Fetching inventory data"
			/>
		);
	}

	if (error) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Ionicons name="alert-circle" size={48} className="text-danger" />
				<Typography variant="title2" className="mt-4 mb-2 text-danger">
					Error Loading Stock
				</Typography>
				<Typography
					variant="body"
					className="mb-4 text-center text-foreground/60"
				>
					{error?.message || "Failed to load workers stock"}
				</Typography>
				<Button onPress={() => refetch()}>Try Again</Button>
			</Container>
		);
	}

	return (
		<Container className="flex-1" isScrollable={false}>
			{/* Header */}
			<View
				className="border-border border-b bg-surface p-4"
				style={{ paddingTop: insets.top + 16 }}
			>
				<View className="mb-3 flex-row items-center gap-3">
					<Button size="sm" variant="outline" onPress={() => router.back()}>
						← Back
					</Button>
					<Typography variant="title1" className="text-foreground">
						All Workers Stock
					</Typography>
				</View>
				<Typography variant="caption" className="text-foreground/60">
					{workerIds.length} workers with stock
				</Typography>
			</View>

			{/* List */}
			<FlatList
				data={workerIds}
				renderItem={renderWorkerStock}
				keyExtractor={(item) => item}
				contentContainerStyle={{ padding: 16 }}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
				}
				ListEmptyComponent={
					<View className="items-center justify-center py-12">
						<Ionicons
							name="people-outline"
							size={64}
							className="text-foreground/20"
						/>
						<Typography variant="body" className="mt-4 text-foreground/60">
							No workers have stock yet
						</Typography>
					</View>
				}
			/>
		</Container>
	);
}
