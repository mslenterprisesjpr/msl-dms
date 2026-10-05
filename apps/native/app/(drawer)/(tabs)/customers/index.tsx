import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, Card, Input, Typography, useToast } from "heroui-native";
import { useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import {
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import { useCustomers, useDeleteCustomer } from "@/hooks/use-customers";
import type { Customer } from "@/types/customer";

export default function CustomersScreen() {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const { toast } = useToast();
	const insets = useSafeAreaInsets();

	const { data, isLoading, refetch } = useCustomers({ search });
	const deleteMutation = useDeleteCustomer();

	const handleDelete = (customer: Customer) => {
		Alert.alert(
			"Delete Customer",
			`Are you sure you want to delete ${customer.name}?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await deleteMutation.mutateAsync(customer._id);
							toast.show({
								variant: "success",
								label: "Customer deleted successfully",
							});
						} catch (error: unknown) {
							toast.show({
								variant: "danger",
								label:
									error instanceof Error
										? error.message
										: "Failed to delete customer",
							});
						}
					},
				},
			],
		);
	};

	const renderCustomer = ({ item }: { item: Customer }) => (
		<Card
			className="mb-3 border-border bg-surface p-4"
			onPress={() => router.push(`/customers/${item._id}`)}
		>
			<View className="flex-row items-start justify-between">
				<View className="flex-1">
					<Typography variant="title3" className="mb-1 text-foreground">
						{item.name}
					</Typography>
					{item.phone && (
						<View className="mb-1 flex-row items-center">
							<Ionicons name="call" size={14} color="#888" />
							<Typography variant="body" className="ml-1 text-foreground/60">
								{item.phone}
							</Typography>
						</View>
					)}
					{item.address && (
						<View className="flex-row items-center">
							<Ionicons name="location" size={14} color="#888" />
							<Typography
								variant="caption"
								className="ml-1 text-foreground/60"
								numberOfLines={1}
							>
								{item.address}
							</Typography>
						</View>
					)}
				</View>

				<View className="flex-row gap-2">
					<Button
						variant="ghost"
						size="sm"
						onPress={() => router.push(`/customers/${item._id}`)}
					>
						<Ionicons name="create" size={18} color="#0ea5e9" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onPress={() => handleDelete(item)}
						isDisabled={deleteMutation.isPending}
					>
						<Ionicons name="trash" size={18} color="#ef4444" />
					</Button>
				</View>
			</View>
		</Card>
	);

	if (isLoading) {
		return <LoadingScreen message="Loading customers..." />;
	}

	return (
		<Container isScrollable={false}>
			<FlatList
				data={data?.data || []}
				renderItem={renderCustomer}
				keyExtractor={(item) => item._id}
				contentContainerStyle={{
					padding: 16,
					paddingTop: insets.top + 16,
				}}
				ListHeaderComponent={
					<>
						<View className="mb-4 flex-row items-center justify-between">
							<Typography variant="title1" className="text-foreground">
								Customers
							</Typography>
							<Button
								variant="solid"
								color="accent"
								size="sm"
								onPress={() => router.push("/customers/create")}
							>
								<Ionicons name="add" size={20} color="white" />
								<Typography variant="body" className="ml-1 text-white">
									Add
								</Typography>
							</Button>
						</View>

						<Input
							placeholder="Search by name or phone..."
							value={search}
							onChangeText={setSearch}
							className="mb-4 border-border bg-surface"
						/>
					</>
				}
				refreshControl={
					<RefreshControl refreshing={isLoading} onRefresh={refetch} />
				}
				ListEmptyComponent={
					<View className="items-center py-8">
						<Typography variant="body" className="text-foreground/60">
							{search ? "No customers found" : "No customers yet"}
						</Typography>
					</View>
				}
			/>
		</Container>
	);
}
