import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	Button,
	Card,
	Input,
	Label,
	TextField,
	Typography,
	useToast,
} from "heroui-native";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { Container } from "@/components/container";
import { useProducts } from "@/hooks/queries/use-products";
import { apiClient } from "@/lib/api-client";
import type { Product } from "@/services/product.service";

const TRANSACTION_TYPES = ["PURCHASE", "ADJUSTMENT"] as const;
type TransactionType = (typeof TRANSACTION_TYPES)[number];

export default function StockEntryScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const { data: productsData, isLoading } = useProducts({
		page: 1,
		limit: 100,
		isActive: true,
	});

	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [type, setType] = useState<TransactionType>("PURCHASE");
	const [cases, setCases] = useState<string>("0");
	const [units, setUnits] = useState<string>("0");
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async () => {
		if (!selectedProduct) {
			toast.show({ variant: "danger", label: "Please select a product" });
			return;
		}

		const numCases = Number.parseInt(cases) || 0;
		const numUnits = Number.parseInt(units) || 0;

		if (numCases === 0 && numUnits === 0) {
			toast.show({
				variant: "danger",
				label: "Please enter at least some cases or units",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			// Call the appropriate endpoint based on type
			const endpoint =
				type === "PURCHASE" ? "/stock/purchase" : "/stock/adjustment";

			await apiClient.post(endpoint, {
				productId: selectedProduct._id,
				cases: numCases,
				units: numUnits,
				note: note.trim() || undefined,
			});

			toast.show({
				variant: "success",
				label: "Stock updated successfully!",
			});

			// Reset form
			setSelectedProduct(null);
			setCases("0");
			setUnits("0");
			setNote("");

			router.back();
		} catch (error: any) {
			console.log("❌ STOCK ENTRY ERROR:", {
				status: error.response?.status,
				data: error.response?.data,
				message: error.message,
			});

			const errorMessage =
				error.response?.data?.message ||
				error.response?.data ||
				error.message ||
				"Failed to update stock";

			toast.show({
				variant: "danger",
				label: "Failed to update stock",
				description: String(errorMessage),
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Container className="flex-1">
			{/* Header */}
			<View className="border-border border-b bg-surface p-4">
				<View className="flex-row items-center gap-3">
					<Button size="sm" variant="outline" onPress={() => router.back()}>
						← Back
					</Button>
					<Typography variant="title1" className="text-foreground">
						Stock Entry
					</Typography>
				</View>
			</View>

			<ScrollView contentContainerStyle={{ padding: 16 }}>
				<Card className="mb-4 p-4">
					{/* Transaction Type */}
					<View className="mb-6">
						<Typography variant="caption" className="mb-2 font-semibold text-foreground">
							Entry Type *
						</Typography>
						<View className="flex-row flex-wrap gap-2">
							{TRANSACTION_TYPES.map((t) => (
								<Button
									key={t}
									size="sm"
									variant={type === t ? "default" : "outline"}
									onPress={() => setType(t)}
									className={type === t ? "bg-success border-success" : ""}
								>
									{t}
								</Button>
							))}
						</View>
						<Typography variant="caption" className="text-foreground/60 mt-2">
							{type === "PURCHASE"
								? "Add new stock from supplier"
								: "Adjust stock for corrections"}
						</Typography>
					</View>

					{/* Product Selection */}
					<View className="mb-6">
						<Typography variant="caption" className="mb-2 font-semibold text-foreground">
							Select Product *
						</Typography>
						{isLoading ? (
							<Typography variant="caption" className="text-foreground/60">
								Loading products...
							</Typography>
						) : (
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								className="flex-row"
							>
								<View className="flex-row gap-2">
									{productsData?.data.map((product) => (
										<Button
											key={product._id}
											size="sm"
											variant={
												selectedProduct?._id === product._id ? "default" : "secondary"
											}
											onPress={() => setSelectedProduct(product)}
											className={
												selectedProduct?._id === product._id
													? "bg-success border-success"
													: ""
											}
										>
											{product.name}
										</Button>
									))}
								</View>
							</ScrollView>
						)}
						{!selectedProduct && (
							<Typography variant="caption" className="text-danger mt-1">
								Required
							</Typography>
						)}
					</View>

					{selectedProduct && (
						<View className="bg-accent/10 p-3 rounded-lg mb-6 border border-accent/20">
							<Typography variant="body" className="font-bold text-accent">
								{selectedProduct.name}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Pack: {selectedProduct.packSize} ({selectedProduct.unitsPerCase}{" "}
								{selectedProduct.unit} per case)
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Current Stock:{" "}
								{selectedProduct.stockDisplay ||
									`${selectedProduct.stock || 0} Units`}
							</Typography>
						</View>
					)}

					{/* Cases & Units Entry */}
					<View className="flex-row gap-4 mb-6">
						<View className="flex-1">
							<TextField>
								<Label>Cases</Label>
								<Input
									placeholder="0"
									value={cases}
									onChangeText={setCases}
									keyboardType="numeric"
								/>
							</TextField>
						</View>
						<View className="flex-1">
							<TextField>
								<Label>Loose Units</Label>
								<Input
									placeholder="0"
									value={units}
									onChangeText={setUnits}
									keyboardType="numeric"
								/>
							</TextField>
						</View>
					</View>

					{/* Note */}
					<View className="mb-6">
						<TextField>
							<Label>Note / Remarks (Optional)</Label>
							<Input
								placeholder="e.g. Received from distributor"
								value={note}
								onChangeText={setNote}
							/>
						</TextField>
					</View>

					{/* Total Calculation Display */}
					{selectedProduct &&
						(Number.parseInt(cases) > 0 || Number.parseInt(units) > 0) && (
							<View className="bg-success/10 p-4 rounded-lg mb-6 border border-success/20">
								<Typography variant="caption" className="text-foreground/60 mb-1">
									Total Units to Add:
								</Typography>
								<Typography variant="title2" className="text-success font-bold">
									{(Number.parseInt(cases) || 0) * selectedProduct.unitsPerCase +
										(Number.parseInt(units) || 0)}{" "}
									Units
								</Typography>
								<Typography variant="caption" className="text-foreground/60 mt-1">
									= {cases || "0"} cases × {selectedProduct.unitsPerCase} +{" "}
									{units || "0"} loose units
								</Typography>
							</View>
						)}

					{/* Action Buttons */}
					<View className="flex-row gap-2">
						<Button
							variant="outline"
							className="flex-1"
							onPress={() => router.back()}
							isDisabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onPress={handleSubmit}
							isLoading={isSubmitting}
						>
							Save Entry
						</Button>
					</View>
				</Card>
			</ScrollView>
		</Container>
	);
}
