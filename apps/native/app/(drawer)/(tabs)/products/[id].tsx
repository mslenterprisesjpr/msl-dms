import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
	ScrollView,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import { useProduct, useUpdateProduct } from "@/hooks/queries/use-products";
import { useImageUpload } from "@/hooks/use-image-upload";
import type { CreateProductDto } from "@/services/product.service";

const UNITS = ["BOTTLE", "PIECE", "KG", "LITER", "PACKET"] as const;

export default function EditProductScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { toast } = useToast();
	const { pickImage, takePhoto, uploadToCloudinary, uploading } =
		useImageUpload();

	const { data: productData, isLoading, error } = useProduct(id!);
	const updateMutation = useUpdateProduct();

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
		cgst: undefined,
		sgst: undefined,
		isActive: true,
	});

	useEffect(() => {
		if (productData?.data) {
			const p = productData.data;
			setFormData({
				name: p.name || "",
				sku: p.sku || "",
				category: p.category || "",
				packSize: p.packSize || "",
				unit: p.unit || "BOTTLE",
				unitsPerCase: p.unitsPerCase || 1,
				purchaseRate: p.purchaseRate || 0,
				sellingRate: p.sellingRate || 0,
				minimumStock: p.minimumStock || 0,
				gstRate: p.gstRate || 0,
				cgst: p.cgst,
				sgst: p.sgst,
				image: p.image,
				isActive: p.isActive !== false,
			});
		}
	}, [productData]);

	const updateField = (field: keyof CreateProductDto, value: any) => {
		setFormData((prev) => {
			const updated = { ...prev, [field]: value };

			// Auto-calculate GST fields based on input
			if (field === "gstRate" && value > 0) {
				// If total GST is changed and CGST/SGST are not set, split evenly
				if (!updated.cgst && !updated.sgst) {
					updated.cgst = value / 2;
					updated.sgst = value / 2;
				}
			} else if ((field === "cgst" || field === "sgst") && value >= 0) {
				// If CGST or SGST is changed, auto-calculate total GST
				const cgst = field === "cgst" ? value : updated.cgst || 0;
				const sgst = field === "sgst" ? value : updated.sgst || 0;
				updated.gstRate = cgst + sgst;
			}

			return updated;
		});
	};

	const handleImageUpload = async (source: "gallery" | "camera") => {
		try {
			const image =
				source === "gallery" ? await pickImage() : await takePhoto();

			if (!image) return;

			const imageUrl = await uploadToCloudinary(image.uri);

			if (imageUrl) {
				updateField("image", imageUrl);
				toast.show({
					variant: "success",
					label: "Image uploaded successfully!",
				});
			} else {
				toast.show({
					variant: "danger",
					label: "Failed to upload image",
				});
			}
		} catch (error: any) {
			console.error("Image upload error:", error);
			toast.show({
				variant: "danger",
				label: "Error uploading image",
			});
		}
	};

	const showImagePickerOptions = () => {
		Alert.alert("Upload Product Image", "Choose an option", [
			{
				text: "Take Photo",
				onPress: () => handleImageUpload("camera"),
			},
			{
				text: "Choose from Gallery",
				onPress: () => handleImageUpload("gallery"),
			},
			{
				text: "Cancel",
				style: "cancel",
			},
		]);
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
			await updateMutation.mutateAsync({ id: id!, data: formData });
			toast.show({
				variant: "success",
				label: "Product updated successfully!",
			});
			router.back();
		} catch (error: any) {
			console.log("❌ UPDATE PRODUCT ERROR:", {
				status: error.response?.status,
				data: error.response?.data,
				message: error.message,
			});

			const errorMessage =
				error.response?.data?.message ||
				error.response?.data ||
				error.message ||
				"Failed to update product";

			toast.show({
				variant: "danger",
				label: "Failed to update product",
				description: String(errorMessage),
			});
		}
	};

	if (isLoading) {
		return (
			<LoadingScreen
				message="Loading product details..."
				subtitle="Please wait while we fetch the product information"
			/>
		);
	}

	if (error || !productData?.data) {
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
				<Typography variant="title2" className="mb-2 text-danger">
					Error Loading Product
				</Typography>
				<Typography
					variant="body"
					className="mb-4 text-center text-foreground/60"
				>
					{error?.message || "Product not found"}
				</Typography>
				<Button onPress={() => router.back()}>Go Back</Button>
			</SafeAreaView>
		);
	}

	return (
		<Container className="flex-1">
			{/* Header */}
			<View className="border-border border-b bg-surface p-4">
				<View className="flex-row items-center gap-3">
					<Button size="sm" variant="outline" onPress={() => router.back()}>
						← Back
					</Button>
					<Typography variant="title1" className="text-foreground">
						Edit Product
					</Typography>
				</View>
			</View>

			<ScrollView contentContainerStyle={{ padding: 16 }}>
				<Card className="mb-4 p-4">
					{/* Product Image Upload */}
					<View className="mb-4">
						<Typography
							variant="caption"
							className="mb-2 font-semibold text-foreground"
						>
							Product Image
						</Typography>
						{formData.image ? (
							<View className="items-center">
								<Image
									source={{ uri: formData.image }}
									style={{
										width: 200,
										height: 200,
										borderRadius: 12,
										marginBottom: 12,
									}}
									resizeMode="cover"
								/>
								<View className="flex-row gap-2">
									<Button
										size="sm"
										variant="secondary"
										onPress={showImagePickerOptions}
										isDisabled={uploading}
									>
										<Ionicons name="refresh" size={16} />
										{" Change"}
									</Button>
									<Button
										size="sm"
										variant="danger"
										onPress={() => updateField("image", undefined)}
										isDisabled={uploading}
									>
										<Ionicons name="trash" size={16} />
										{" Remove"}
									</Button>
								</View>
							</View>
						) : (
							<Button
								variant="outline"
								onPress={showImagePickerOptions}
								isDisabled={uploading}
							>
								{uploading ? (
									<>
										<ActivityIndicator size="small" color="#fff" />
										{" Uploading..."}
									</>
								) : (
									<>
										<Ionicons name="camera" size={18} />
										{" Upload Image"}
									</>
								)}
							</Button>
						)}
					</View>

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
							<Label>GST Rate (%) - Total</Label>
							<Input
								placeholder="e.g., 18"
								value={formData.gstRate?.toString() || "0"}
								onChangeText={(text) =>
									updateField("gstRate", Number.parseFloat(text) || 0)
								}
								keyboardType="numeric"
							/>
							<Description>
								{formData.cgst && formData.sgst
									? `Auto-calculated: CGST ${formData.cgst}% + SGST ${formData.sgst}%`
									: "Total GST percentage (will auto-split into CGST/SGST)"}
							</Description>
						</TextField>
					</View>

					{/* CGST & SGST Row */}
					<View className="mb-4 flex-row gap-2">
						<View className="flex-1">
							<TextField>
								<Label>CGST (%)</Label>
								<Input
									placeholder="e.g., 9"
									value={formData.cgst?.toString() || ""}
									onChangeText={(text) =>
										updateField(
											"cgst",
											text ? Number.parseFloat(text) : undefined,
										)
									}
									keyboardType="numeric"
								/>
							</TextField>
						</View>
						<View className="flex-1">
							<TextField>
								<Label>SGST (%)</Label>
								<Input
									placeholder="e.g., 9"
									value={formData.sgst?.toString() || ""}
									onChangeText={(text) =>
										updateField(
											"sgst",
											text ? Number.parseFloat(text) : undefined,
										)
									}
									keyboardType="numeric"
								/>
							</TextField>
						</View>
					</View>

					{/* Is Active Toggle */}
					<View className="mb-6 flex-row items-center justify-between">
						<Typography
							variant="body"
							className="font-semibold text-foreground"
						>
							Product is Active
						</Typography>
						<Button
							size="sm"
							variant={formData.isActive ? "success" : "secondary"}
							onPress={() => updateField("isActive", !formData.isActive)}
						>
							{formData.isActive ? "Active" : "Inactive"}
						</Button>
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
							isDisabled={updateMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onPress={handleSubmit}
							isLoading={updateMutation.isPending}
						>
							Update Product
						</Button>
					</View>
				</Card>
			</ScrollView>
		</Container>
	);
}
