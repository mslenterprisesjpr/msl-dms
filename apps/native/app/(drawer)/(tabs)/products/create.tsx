import { useRouter } from "expo-router";
import { Button, Card, TextField, Typography } from "heroui-native";
import React, { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Container } from "@/components/container";
import { useCreateProduct } from "@/hooks/queries/use-products";
import type { CreateProductDto } from "@/services/product.service";

const UNITS = ["BOTTLE", "PIECE", "KG", "LITER", "PACKET"] as const;

export default function CreateProductScreen() {
	const router = useRouter();
	const createMutation = useCreateProduct();

	const [formData, setFormData] = useState<CreateProductDto>({
		name: "",
		sku: "",
		category: "",
		packSize: "",
		unit: "BOTTLE",
		unitsPerCase: 1,
		purchaseRate: 0,
		sellingRate: 0,
		minimumStock: 0,
		gstRate: 0,
		isActive: true,
	});

	const updateField = (field: keyof CreateProductDto, value: any) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = async () => {
		// Validation
		if (!formData.name.trim()) {
			Alert.alert("Error", "Product name is required");
			return;
		}
		if (!formData.sku.trim()) {
			Alert.alert("Error", "SKU is required");
			return;
		}
		if (!formData.packSize.trim()) {
			Alert.alert("Error", "Pack size is required");
			return;
		}
		if (formData.unitsPerCase < 1) {
			Alert.alert("Error", "Units per case must be at least 1");
			return;
		}
		if (formData.purchaseRate < 0) {
			Alert.alert("Error", "Purchase rate must be positive");
			return;
		}
		if (formData.sellingRate < 0) {
			Alert.alert("Error", "Selling rate must be positive");
			return;
		}

		try {
			await createMutation.mutateAsync(formData);
			Alert.alert("Success", "Product created successfully!", [
				{
					text: "OK",
					onPress: () => router.back(),
				},
			]);
		} catch (error: any) {
			Alert.alert(
				"Error",
				error.response?.data?.message ||
					error.message ||
					"Failed to create product",
			);
		}
	};

	return (
		<Container className="flex-1">
			<ScrollView contentContainerStyle={{ padding: 16 }}>
				<Card className="mb-4 p-4">
					{/* Product Name */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>Product Name *</TextField.Label>
							<TextField.Input
								placeholder="e.g., Coca Cola"
								value={formData.name}
								onChangeText={(text) => updateField("name", text)}
							/>
						</TextField>
					</View>

					{/* SKU */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>SKU *</TextField.Label>
							<TextField.Input
								placeholder="e.g., CC-250ML"
								value={formData.sku}
								onChangeText={(text) => updateField("sku", text.toUpperCase())}
								autoCapitalize="characters"
							/>
							<TextField.Description>
								Unique product code for your organization
							</TextField.Description>
						</TextField>
					</View>

					{/* Category */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>Category</TextField.Label>
							<TextField.Input
								placeholder="e.g., Beverages"
								value={formData.category}
								onChangeText={(text) => updateField("category", text)}
							/>
						</TextField>
					</View>

					{/* Pack Size */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>Pack Size *</TextField.Label>
							<TextField.Input
								placeholder="e.g., 250ml, 500ml, 1L"
								value={formData.packSize}
								onChangeText={(text) => updateField("packSize", text)}
							/>
						</TextField>
					</View>

					{/* Unit */}
					<View className="mb-4">
						<Typography variant="caption" className="mb-2 font-semibold">
							Unit Type *
						</Typography>
						<View className="flex-row flex-wrap gap-2">
							{UNITS.map((unit) => (
								<Button
									key={unit}
									size="sm"
									variant={formData.unit === unit ? "accent" : "outline"}
									onPress={() => updateField("unit", unit)}
								>
									{unit}
								</Button>
							))}
						</View>
					</View>

					{/* Units Per Case */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>Units Per Case *</TextField.Label>
							<TextField.Input
								placeholder="e.g., 24"
								value={formData.unitsPerCase.toString()}
								onChangeText={(text) =>
									updateField("unitsPerCase", Number.parseInt(text) || 0)
								}
								keyboardType="numeric"
							/>
							<TextField.Description>
								How many units in one case?
							</TextField.Description>
						</TextField>
					</View>

					{/* Purchase Rate */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>Purchase Rate (per case) *</TextField.Label>
							<TextField.Input
								placeholder="e.g., 240"
								value={formData.purchaseRate.toString()}
								onChangeText={(text) =>
									updateField("purchaseRate", Number.parseFloat(text) || 0)
								}
								keyboardType="numeric"
							/>
						</TextField>
					</View>

					{/* Selling Rate */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>Selling Rate (per case) *</TextField.Label>
							<TextField.Input
								placeholder="e.g., 300"
								value={formData.sellingRate.toString()}
								onChangeText={(text) =>
									updateField("sellingRate", Number.parseFloat(text) || 0)
								}
								keyboardType="numeric"
							/>
						</TextField>
					</View>

					{/* Minimum Stock */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>Minimum Stock (in cases)</TextField.Label>
							<TextField.Input
								placeholder="e.g., 5"
								value={formData.minimumStock?.toString() || "0"}
								onChangeText={(text) =>
									updateField("minimumStock", Number.parseInt(text) || 0)
								}
								keyboardType="numeric"
							/>
							<TextField.Description>
								Alert when stock goes below this level
							</TextField.Description>
						</TextField>
					</View>

					{/* GST Rate */}
					<View className="mb-4">
						<TextField>
							<TextField.Label>GST Rate (%)</TextField.Label>
							<TextField.Input
								placeholder="e.g., 18"
								value={formData.gstRate?.toString() || "0"}
								onChangeText={(text) =>
									updateField("gstRate", Number.parseFloat(text) || 0)
								}
								keyboardType="numeric"
							/>
						</TextField>
					</View>

					{/* Profit Display */}
					{formData.purchaseRate > 0 && formData.sellingRate > 0 && (
						<Card variant="secondary" className="mb-4 p-3">
							<Typography variant="caption" className="mb-1 text-gray-600">
								Profit Analysis
							</Typography>
							<Typography variant="body" className="font-semibold">
								Profit per case: ₹
								{(formData.sellingRate - formData.purchaseRate).toFixed(2)}
							</Typography>
							<Typography variant="caption" className="text-gray-600">
								Margin:{" "}
								{(
									((formData.sellingRate - formData.purchaseRate) /
										formData.purchaseRate) *
									100
								).toFixed(1)}
								%
							</Typography>
						</Card>
					)}

					{/* Action Buttons */}
					<View className="flex-row gap-2">
						<Button
							variant="outline"
							className="flex-1"
							onPress={() => router.back()}
							isDisabled={createMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onPress={handleSubmit}
							isLoading={createMutation.isPending}
						>
							Create Product
						</Button>
					</View>
				</Card>
			</ScrollView>
		</Container>
	);
}
