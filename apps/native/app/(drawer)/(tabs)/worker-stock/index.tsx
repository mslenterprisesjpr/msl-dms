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
import type { WorkerStock } from "@/hooks/queries/use-worker-stock";
import { useWorkerStock } from "@/hooks/queries/use-worker-stock";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function WorkerStockScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [refreshing, setRefreshing] = useState(false);

	// Check if user is logged in
	const { data: session } = authClient.useSession();
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const organizations = useOrganizationStore((state) => state.organizations);

	// Get current org
	const currentOrg =
		organizations.find((org) => org.id === currentOrgId) || null;

	// Fetch worker's stock
	const { data: stockData, isLoading, error, refetch } = useWorkerStock();

	const handleRefresh = async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	};

	const renderStockItem = ({ item }: { item: WorkerStock }) => (
		<Card className="mb-3">
			<View className="p-4">
				<View className="mb-3 flex-row items-start justify-between">
					<View className="flex-1 pr-2">
						<Typography variant="title3" className="mb-1 text-foreground">
							{item.productId.name}
						</Typography>
						<Typography variant="caption" className="mb-2 text-foreground/50">
							SKU: {item.productId.sku} | {item.productId.packSize}
						</Typography>

						<View className="flex-row flex-wrap items-center gap-2">
							<Chip size="sm" variant="default">
								{item.productId.unit}
							</Chip>
							{item.stockInCases !== undefined && (
								<Chip size="sm" variant="secondary">
									{item.stockInCases} Cases + {item.remainingUnits} Units
								</Chip>
							)}
						</View>
					</View>

					<View className="items-end">
						<Typography variant="title2" className="font-bold text-accent">
							{item.stock}
						</Typography>
						<Typography variant="caption" className="text-foreground/60">
							units
						</Typography>
					</View>
				</View>

				{/* Stock Display */}
				{item.stockDisplay && (
					<View className="mt-2 border-border border-t pt-2">
						<Typography variant="body" className="text-foreground/80">
							📦 {item.stockDisplay}
						</Typography>
					</View>
				)}
			</View>
		</Card>
	);

	// Check if user is logged in
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
				<Typography
					variant="body"
					className="mb-4 text-center text-foreground/60"
				>
					You need to be logged in to view your stock
				</Typography>
			</SafeAreaView>
		);
	}

	// Check if organization is selected
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
				<Ionicons name="business" size={48} className="text-foreground/30" />
				<Typography variant="title2" className="mt-4 mb-2 text-foreground">
					Select Organization
				</Typography>
				<Typography
					variant="body"
					className="mb-4 text-center text-foreground/60"
				>
					Please select an organization to view stock
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
				message="Loading your stock..."
				subtitle="Fetching inventory details"
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
					Error Loading Stock
				</Typography>
				<Typography
					variant="body"
					className="mb-4 text-center text-foreground/60"
				>
					{error?.message || "Failed to load your stock"}
				</Typography>
				<Button onPress={() => refetch()}>Try Again</Button>
			</SafeAreaView>
		);
	}

	const stockItems = stockData?.data || [];

	return (
		<Container className="flex-1" isScrollable={false}>
			{/* Header */}
			<View
				className="border-border border-b bg-surface p-4"
				style={{ paddingTop: insets.top + 16 }}
			>
				<View className="mb-3 flex-row items-center justify-between">
					<Typography variant="title1" className="text-foreground">
						My Stock
					</Typography>
					<View className="flex-row gap-2">
						{/* Admin: View all workers */}
						<Button
							size="sm"
							variant="secondary"
							onPress={() =>
								router.push("/(drawer)/(tabs)/worker-stock/all-workers")
							}
						>
							<Ionicons name="people" size={18} />
						</Button>
						{/* Admin: Issue stock */}
						<Button
							size="sm"
							variant="primary"
							onPress={() => router.push("/(drawer)/(tabs)/worker-stock/issue")}
						>
							<Ionicons name="add" size={18} />
						</Button>
						<Button
							size="sm"
							variant="secondary"
							onPress={() =>
								router.push("/(drawer)/(tabs)/worker-stock/history")
							}
						>
							<Ionicons name="time" size={18} />
						</Button>
						<Button
							size="sm"
							variant="accent"
							onPress={() =>
								router.push("/(drawer)/(tabs)/worker-stock/return")
							}
						>
							<Ionicons name="arrow-undo" size={18} />
						</Button>
					</View>
				</View>

				<Typography variant="caption" className="text-foreground/60">
					Your current inventory
				</Typography>
			</View>

			{/* List */}
			<FlatList
				data={stockItems}
				renderItem={renderStockItem}
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
							No stock assigned yet
						</Typography>
						<Typography
							variant="caption"
							className="mt-2 text-center text-foreground/40"
						>
							Contact admin to issue stock
						</Typography>
					</View>
				}
			/>
		</Container>
	);
}
