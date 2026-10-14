import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	Button,
	Card,
	Description,
	Input,
	Label,
	TextField,
	Typography,
	useToast,
} from "heroui-native";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import type { WorkerStock } from "@/hooks/queries/use-worker-stock";
import {
	useReturnStock,
	useWorkerStock,
} from "@/hooks/queries/use-worker-stock";

export default function ReturnStockScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();

	const { data: stockData, isLoading } = useWorkerStock();
	const returnMutation = useReturnStock();

	const [selectedProduct, setSelectedProduct] = useState<WorkerStock | null>(
		null,
	);
	const [cases, setCases] = useState("");
	const [units, setUnits] = useState("");
	const [note, setNote] = useState("");

	const stockItems = stockData?.data || [];

	const handleProductSelect = (product: WorkerStock) => {
		setSelectedProduct(product);
		setCases("");
		setUnits("");
		setNote("");
	};

	const handleSubmit = async () => {
		if (!selectedProduct) {
			toast.show({ variant: "danger", label: "Please select a product" });
			return;
		}

		const casesNum = Number.parseInt(cases || "0");
		const unitsNum = Number.parseInt(units || "0");

		if (casesNum === 0 && unitsNum === 0) {
			toast.show({
				variant: "danger",
				label: "Please enter cases or units to return",
			});
			return;
		}

		const unitsPerCase = selectedProduct.productId.unitsPerCase;
		const totalUnits = casesNum * unitsPerCase + unitsNum;

		if (totalUnits > selectedProduct.stock) {
			toast.show({
				variant: "danger",
				label: `Cannot return more than available stock (${selectedProduct.stock} units)`,
			});
			return;
		}

		Alert.alert(
			"Confirm Return",
			`Return ${casesNum} cases + ${unitsNum} units (${totalUnits} total units) of ${selectedProduct.productId.name}?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Confirm",
					style: "default",
					onPress: async () => {
						try {
							await returnMutation.mutateAsync({
								productId: selectedProduct.productId._id,
								quantity: totalUnits,
								cases: casesNum,
								units: unitsNum,
								note: note.trim() || undefined,
							});

							toast.show({
								variant: "success",
								label: "Stock returned successfully!",
							});

							router.back();
						} catch (error: any) {
							console.error("Return stock error:", error);
							toast.show({
								variant: "danger",
								label:
									error.response?.data?.message || "Failed to return stock",
							});
						}
					},
				},
			],
		);
	};

	if (isLoading) {
		return <LoadingScreen message="Loading stock..." />;
	}

	return (
		<Container className="flex-1">
			{/* Header */}
			<View
				className="border-border border-b bg-surface p-4"
				style={{ paddingTop: insets.top + 16 }}
			>
				<View className="flex-row items-center gap-3">
					<Button size="sm" variant="outline" onPress={() => router.back()}>
						← Back
					</Button>
					<Typography variant="title1" className="text-foreground">
						Return Stock
					</Typography>
				</View>
			</View>

			<ScrollView contentContainerStyle={{ padding: 16 }}>
				<Card className="mb-4 p-4">
					{/* Product Selection */}
					<View className="mb-4">
						<Label>Select Product *</Label>
						{stockItems.length === 0 ? (
							<Typography variant="caption" className="text-foreground/60">
								No stock available to return
							</Typography>
						) : (
							<View className="mt-2 gap-2">
								{stockItems.map((item) => (
									<Button
										key={item._id}
										variant={
											selectedProduct?._id === item._id ? "primary" : "outline"
										}
										onPress={() => handleProductSelect(item)}
										className="justify-start"
									>
										<View className="flex-1 flex-row items-center justify-between">
											<View>
												<Typography variant="body" className="text-left">
													{item.productId.name}
												</Typography>
												<Typography variant="caption" className="text-left">
													Stock: {item.stock} units
												</Typography>
											</View>
											{selectedProduct?._id === item._id && (
												<Ionicons name="checkmark-circle" size={20} />
											)}
										</View>
									</Button>
								))}
							</View>
						)}
					</View>

					{selectedProduct && (
						<>
							{/* Available Stock Info */}
							<Card className="mb-4 bg-accent/10">
								<View className="p-3">
									<Typography
										variant="caption"
										className="mb-1 text-foreground/60"
									>
										Available Stock
									</Typography>
									<Typography variant="title3" className="text-accent">
										{selectedProduct.stockDisplay ||
											`${selectedProduct.stock} units`}
									</Typography>
									<Typography variant="caption" className="text-foreground/50">
										({selectedProduct.productId.unitsPerCase} units per case)
									</Typography>
								</View>
							</Card>

							{/* Return Quantity */}
							<View className="mb-4">
								<Label>Return Quantity *</Label>
								<View className="mt-2 flex-row gap-3">
									<View className="flex-1">
										<TextField>
											<Label>Cases</Label>
											<Input
												placeholder="0"
												keyboardType="numeric"
												value={cases}
												onChangeText={setCases}
											/>
										</TextField>
									</View>
									<View className="flex-1">
										<TextField>
											<Label>Units</Label>
											<Input
												placeholder="0"
												keyboardType="numeric"
												value={units}
												onChangeText={setUnits}
											/>
										</TextField>
									</View>
								</View>
								{(cases || units) && (
									<Description className="mt-2">
										Total:{" "}
										{Number.parseInt(cases || "0") *
											selectedProduct.productId.unitsPerCase +
											Number.parseInt(units || "0")}{" "}
										units
									</Description>
								)}
							</View>

							{/* Note */}
							<View className="mb-4">
								<TextField>
									<Label>Note (Optional)</Label>
									<Input
										placeholder="Reason for return..."
										value={note}
										onChangeText={setNote}
										multiline
										numberOfLines={3}
									/>
								</TextField>
							</View>

							{/* Submit Button */}
							<Button
								onPress={handleSubmit}
								isLoading={returnMutation.isPending}
								disabled={!selectedProduct || (!cases && !units)}
								className="w-full"
							>
								Return Stock
							</Button>
						</>
					)}
				</Card>
			</ScrollView>
		</Container>
	);
}
