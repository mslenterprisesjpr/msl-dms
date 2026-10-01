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
import { ScrollView, View } from "react-native";
import { Container } from "@/components/container";
import { useCreateProduct } from "@/hooks/queries/use-products";
import type { CreateProductDto } from "@/services/product.service";

const UNITS = ["BOTTLE", "PIECE", "KG", "LITER", "PACKET"] as const;

export default function CreateProductScreen() {
	const router = useRouter();
	const createMutation = useCreateProduct();
	const { toast } = useToast();

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
			toast.show({ variant: "danger", label: "Product name is required" });
			return;
		}
		if (!formData.sku.trim()) {
			toast.show({ variant: "danger", label: "SKU is required" });
			return;
		}
		if (!formData.packSize.trim()) {
			toast.show({ variant: "danger", label: "Pack size is required" });
			return;
		}
		if (formData.unitsPerCase < 1) {
			toast.show({
				variant: "danger",
				label: "Units per case must be at least 1",
			});
			return;
		}
		if (formData.purchaseRate < 0) {
			toast.show({
				variant: "danger",
				label: "Purchase rate must be positive",
			});
			return;
		}
		if (formData.sellingRate < 0) {
			toast.show({ variant: "danger", label: "Selling rate must be positive" });
			return;
		}

		try {
			await createMutation.mutateAsync(formData);
			toast.show({
				variant: "success",
				label: "Product created successfully!",
			});
			router.back();
		} catch (error: any) {
			// Log the full error for debugging
			console.log("❌ CREATE PRODUCT ERROR:", {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
				message: error.message,
				fullError: error,
			});

			// Get the actual error message from server
			const errorMessage =
				error.response?.data?.message ||
				error.response?.data ||
				error.message ||
				"Failed to create product";

			// Show toast with actual server error
			toast.show({
				variant: "danger",
				label: "Failed to create product",
				description: String(errorMessage),
			});
		}
	};

	return (
		<Container className="flex-1">
			{/* Header */}
			<View
				className="border-border border-b bg-surface p-4"
				style={{ paddingTop: insets.top + 16 }}
			>
				<View className="flex-row items-center justify-between">
					<View className="flex-row items-center gap-3">
						<Button size="sm" variant="outline" onPress={() => router.back()}>
							← Back
						</Button>
						<Typography variant="title1" className="text-foreground">
							Create Product
						</Typography>
					</View>
				</View>
			</View>

			<ScrollView contentContainerStyle={{ padding: 16 }}>
				<Card className="mb-4 p-4">
					{/* Product Name */}
					<View className="mb-4">
						<TextField>
							<Label>Product Name *</Label>
							<Input
								placeholder="e.g., Coca Cola"
								value={formData.name}
								onChangeText={(text) => updateField("name", text)}
							/>
						</TextField>
					</View>

					{/* SKU */}
					<View className="mb-4">
						<TextField>
							<Label>SKU *</Label>
							<Input
								placeholder="e.g., CC-250ML"
								value={formData.sku}
								onChangeText={(text) => updateField("sku", text.toUpperCase())}
								autoCapitalize="characters"
							/>
							<Description>
								Unique product code for your organization
							</Description>
						</TextField>
					</View>

					{/* Category */}
					<View className="mb-4">
						<TextField>
							<Label>Category</Label>
							<Input
								placeholder="e.g., Beverages"
								value={formData.category}
								onChangeText={(text) => updateField("category", text)}
							/>
						</TextField>
					</View>

					{/* Pack Size */}
					<View className="mb-4">
						<TextField>
							<Label>Pack Size *</Label>
							<Input
								placeholder="e.g., 250ml, 500ml, 1L"
								value={formData.packSize}
								onChangeText={(text) => updateField("packSize", text)}
							/>
						</TextField>
					</View>

					{/* Unit */}
					<View className="mb-4">
						<Typography
							variant="caption"
							className="mb-2 font-semibold text-foreground"
						>
							Unit Type *
						</Typography>
						<View className="flex-row flex-wrap gap-2">
							{UNITS.map((unit) => (
								<Button
									key={unit}
									size="sm"
									variant={formData.unit === unit ? "default" : "outline"}
									onPress={() => updateField("unit", unit)}
									className={
										formData.unit === unit ? "border-success bg-success" : ""
									}
								>
									{unit}
								</Button>
							))}
						</View>
					</View>

					{/* Units Per Case */}
					<View className="mb-4">
						<TextField>
							<Label>Units Per Case *</Label>
							<Input
								placeholder="e.g., 24"
								value={formData.unitsPerCase.toString()}
								onChangeText={(text) =>
									updateField("unitsPerCase", Number.parseInt(text, 10) || 0)
								}
								keyboardType="numeric"
							/>
							<Description>How many units in one case?</Description>
						</TextField>
					</View>

					{/* Purchase Rate */}
					<View className="mb-4">
						<TextField>
							<Label>Purchase Rate (per case) *</Label>
							<Input
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
							<Label>Selling Rate (per case) *</Label>
							<Input
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
							<Label>Minimum Stock (in cases)</Label>
							<Input
								placeholder="e.g., 5"
								value={formData.minimumStock?.toString() || "0"}
								onChangeText={(text) =>
									updateField("minimumStock", Number.parseInt(text, 10) || 0)
								}
								keyboardType="numeric"
							/>
							<Description>Alert when stock goes below this level</Description>
						</TextField>
					</View>

					{/* GST Rate */}
					<View className="mb-4">
						<TextField>
							<Label>GST Rate (%)</Label>
							<Input
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
							<Typography variant="caption" className="mb-1 text-foreground/60">
								Profit Analysis
							</Typography>
							<Typography
								variant="body"
								className="font-semibold text-foreground"
							>
								Profit per case: ₹
								{(formData.sellingRate - formData.purchaseRate).toFixed(2)}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
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
