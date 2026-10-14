import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor, useToast } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	useCreateProduct,
	useProduct,
	useUpdateProduct,
} from "@/hooks/queries/use-products";
import { useImageUpload } from "@/hooks/use-image-upload";
import type { CreateProductDto } from "@/services/product.service";

const UNITS = ["BOTTLE", "PIECE", "KG", "LITER", "PACKET"] as const;
const CATEGORIES = ["Beverages", "Snacks", "Others"];

export default function CreateOrEditProductScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { toast } = useToast();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const isEditing = !!id;

	const createMutation = useCreateProduct();
	const updateMutation = useUpdateProduct();
	const { data: productResponse, isLoading: isLoadingProduct } = useProduct(
		id || "",
	);
	const existingProduct = productResponse?.data;

	const { pickImage, takePhoto, uploadToCloudinary, uploading } =
		useImageUpload();

	const [formData, setFormData] = useState<CreateProductDto>({
		name: "",
		sku: "",
		category: "Beverages",
		packSize: "250 ml",
		unit: "BOTTLE",
		unitsPerCase: 24,
		purchaseRate: 15,
		sellingRate: 20,
		minimumStock: 5,
		gstRate: 18,
		cgst: 9,
		sgst: 9,
		isActive: true,
	});

	// Populate if editing
	useEffect(() => {
		if (existingProduct) {
			setFormData({
				name: existingProduct.name || "",
				sku: existingProduct.sku || "",
				category: existingProduct.category || "Beverages",
				packSize: existingProduct.packSize || "",
				unit: (existingProduct.unit as any) || "BOTTLE",
				unitsPerCase: existingProduct.unitsPerCase || 1,
				purchaseRate: existingProduct.purchaseRate || 0,
				sellingRate: existingProduct.sellingRate || 0,
				minimumStock: existingProduct.minimumStock || 0,
				gstRate: existingProduct.gstRate || 0,
				cgst: existingProduct.cgst,
				sgst: existingProduct.sgst,
				image: existingProduct.image,
				isActive: existingProduct.isActive ?? true,
			});
		}
	}, [existingProduct]);

	const updateField = (field: keyof CreateProductDto, value: any) => {
		setFormData((prev) => {
			const updated = { ...prev, [field]: value };

			// Auto-calculate GST
			if (field === "gstRate" && value > 0) {
				updated.cgst = value / 2;
				updated.sgst = value / 2;
			}
			return updated;
		});
	};

	// Image Upload Handler
	const handlePickImage = async (source: "gallery" | "camera") => {
		try {
			const img = source === "gallery" ? await pickImage() : await takePhoto();
			if (!img) return;

			const url = await uploadToCloudinary(img.uri);
			if (url) {
				updateField("image", url);
				toast.show({
					variant: "success",
					label: "Image uploaded successfully!",
				});
			}
		} catch (error: any) {
			Alert.alert("Upload Error", error.message || "Failed to upload image");
		}
	};

	// Margin Calculations
	const marginPerUnit = useMemo(() => {
		return (formData.sellingRate || 0) - (formData.purchaseRate || 0);
	}, [formData.sellingRate, formData.purchaseRate]);

	const marginPercent = useMemo(() => {
		if (!formData.purchaseRate || formData.purchaseRate <= 0) return 0;
		return (marginPerUnit / formData.purchaseRate) * 100;
	}, [marginPerUnit, formData.purchaseRate]);

	// Submit Form
	const handleSubmit = async () => {
		if (!formData.name.trim()) {
			Alert.alert("Missing Name", "Please enter product name");
			return;
		}
		if (!formData.sku.trim()) {
			Alert.alert("Missing SKU", "Please enter product SKU");
			return;
		}
		if (!formData.packSize.trim()) {
			Alert.alert("Missing Pack Size", "Please enter pack size (e.g. 250 ml)");
			return;
		}

		try {
			if (isEditing && id) {
				await updateMutation.mutateAsync({ id, data: formData });
				toast.show({
					variant: "success",
					label: "Product updated successfully!",
				});
			} else {
				await createMutation.mutateAsync(formData);
				toast.show({
					variant: "success",
					label: "Product created successfully!",
				});
			}
			router.back();
		} catch (error: any) {
			const errMsg =
				error.response?.data?.message ||
				error.message ||
				"Failed to save product";
			Alert.alert("Error", String(errMsg));
		}
	};

	const isPending = isEditing
		? updateMutation.isPending
		: createMutation.isPending;

	if (isEditing && isLoadingProduct) {
		return (
			<View className="flex-1 items-center justify-center bg-white dark:bg-zinc-950">
				<ActivityIndicator size="large" color={themeAccent} />
				<Text className="mt-3 font-semibold text-slate-400 text-xs">
					Loading product details...
				</Text>
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			className="flex-1 bg-white dark:bg-zinc-950"
		>
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					padding: 16,
					paddingBottom: insets.bottom + 40,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* 1. PRODUCT IMAGE */}
				<View className="mb-5 items-center">
					{formData.image ? (
						<View className="relative mb-3 items-center">
							<Image
								source={{ uri: formData.image }}
								className="h-32 w-32 rounded-2xl bg-slate-100"
								resizeMode="cover"
							/>
							<Pressable
								onPress={() => updateField("image", undefined)}
								className="absolute -top-2 -right-2 h-7 w-7 items-center justify-center rounded-full bg-red-500 shadow-md"
							>
								<Ionicons name="close" size={16} color="#ffffff" />
							</Pressable>
						</View>
					) : (
						<View className="mb-3 h-28 w-28 items-center justify-center rounded-2xl border border-slate-300 border-dashed bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900">
							<Ionicons name="wine-outline" size={36} color={themeAccent} />
							<Text className="mt-1 font-medium text-[11px] text-slate-400">
								No Image
							</Text>
						</View>
					)}

					<View className="flex-row gap-2">
						<Pressable
							onPress={() => handlePickImage("gallery")}
							disabled={uploading}
							className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<Ionicons name="image-outline" size={16} color="#475569" />
							<Text className="ml-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
								Gallery
							</Text>
						</Pressable>
						<Pressable
							onPress={() => handlePickImage("camera")}
							disabled={uploading}
							className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<Ionicons name="camera-outline" size={16} color="#475569" />
							<Text className="ml-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
								Camera
							</Text>
						</Pressable>
					</View>
				</View>

				{/* 2. PRODUCT NAME */}
				<View className="mb-4">
					<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
						Product Name <Text className="text-red-500">*</Text>
					</Text>
					<TextInput
						value={formData.name}
						onChangeText={(t) => updateField("name", t)}
						placeholder="e.g. Campa Cola 250 ml"
						placeholderTextColor="#94a3b8"
						className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
					/>
				</View>

				{/* 3. SKU & CATEGORY (Side by Side) */}
				<View className="mb-4 flex-row gap-3">
					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							SKU / Item Code <Text className="text-red-500">*</Text>
						</Text>
						<TextInput
							value={formData.sku}
							onChangeText={(t) => updateField("sku", t.toUpperCase())}
							placeholder="CC250"
							placeholderTextColor="#94a3b8"
							autoCapitalize="characters"
							className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
					</View>

					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							Category
						</Text>
						<TextInput
							value={formData.category}
							onChangeText={(t) => updateField("category", t)}
							placeholder="Beverages"
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
					</View>
				</View>

				{/* Category Chips */}
				<View className="mb-4 flex-row gap-2">
					{CATEGORIES.map((c) => (
						<Pressable
							key={c}
							onPress={() => updateField("category", c)}
							className={`rounded-lg px-3 py-1.5 ${
								formData.category === c
									? "bg-accent"
									: "border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
							}`}
						>
							<Text
								className={`font-semibold text-xs ${
									formData.category === c
										? "text-accent-foreground"
										: "text-slate-600 dark:text-zinc-300"
								}`}
							>
								{c}
							</Text>
						</Pressable>
					))}
				</View>

				{/* 4. PACK SIZE, UNIT & UNITS PER CASE */}
				<View className="mb-4 flex-row gap-3">
					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							Pack Size <Text className="text-red-500">*</Text>
						</Text>
						<TextInput
							value={formData.packSize}
							onChangeText={(t) => updateField("packSize", t)}
							placeholder="250 ml"
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
					</View>

					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							Units / Case <Text className="text-red-500">*</Text>
						</Text>
						<TextInput
							value={String(formData.unitsPerCase || "")}
							onChangeText={(t) =>
								updateField("unitsPerCase", Number.parseInt(t, 10) || 1)
							}
							placeholder="24"
							keyboardType="numeric"
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
					</View>
				</View>

				{/* Unit Options */}
				<View className="mb-4">
					<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
						Unit Type
					</Text>
					<ScrollView horizontal showsHorizontalScrollIndicator={false}>
						<View className="flex-row gap-2">
							{UNITS.map((u) => (
								<Pressable
									key={u}
									onPress={() => updateField("unit", u)}
									className={`rounded-lg px-3 py-1.5 ${
										formData.unit === u
											? "bg-[#0d9488]"
											: "border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
									}`}
								>
									<Text
										className={`font-semibold text-xs ${
											formData.unit === u
												? "text-white"
												: "text-slate-600 dark:text-zinc-300"
										}`}
									>
										{u}
									</Text>
								</Pressable>
							))}
						</View>
					</ScrollView>
				</View>

				{/* 5. PURCHASE RATE & SELLING RATE (Side by Side) */}
				<View className="mb-4">
					<View className="flex-row gap-3">
						<View className="flex-1">
							<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
								Purchase Rate (₹) <Text className="text-red-500">*</Text>
							</Text>
							<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
								<Text className="mr-1 font-semibold text-slate-400 text-sm">
									₹
								</Text>
								<TextInput
									value={String(formData.purchaseRate ?? "")}
									onChangeText={(t) =>
										updateField("purchaseRate", Number.parseFloat(t) || 0)
									}
									keyboardType="decimal-pad"
									placeholder="15.00"
									placeholderTextColor="#94a3b8"
									className="flex-1 font-semibold text-slate-900 text-sm dark:text-white"
								/>
							</View>
						</View>

						<View className="flex-1">
							<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
								Selling Rate (₹) <Text className="text-red-500">*</Text>
							</Text>
							<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
								<Text className="mr-1 font-semibold text-slate-400 text-sm">
									₹
								</Text>
								<TextInput
									value={String(formData.sellingRate ?? "")}
									onChangeText={(t) =>
										updateField("sellingRate", Number.parseFloat(t) || 0)
									}
									keyboardType="decimal-pad"
									placeholder="20.00"
									placeholderTextColor="#94a3b8"
									className="flex-1 font-semibold text-slate-900 text-sm dark:text-white"
								/>
							</View>
						</View>
					</View>

					{/* Live Margin Indicator */}
					{formData.purchaseRate > 0 && formData.sellingRate > 0 && (
						<View className="mt-2 flex-row items-center justify-between rounded-lg bg-emerald-50/80 px-3 py-1.5 dark:bg-emerald-950/30">
							<Text className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-400">
								📈 Profit Margin: ₹{marginPerUnit.toFixed(2)} (
								{marginPercent.toFixed(1)}%)
							</Text>
							<Text className="text-[10px] text-emerald-600">per item</Text>
						</View>
					)}
				</View>

				{/* 6. MINIMUM STOCK & GST */}
				<View className="mb-6 flex-row gap-3">
					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							Min Stock Alert (Cases)
						</Text>
						<TextInput
							value={String(formData.minimumStock ?? "")}
							onChangeText={(t) =>
								updateField("minimumStock", Number.parseInt(t, 10) || 0)
							}
							keyboardType="numeric"
							placeholder="5"
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
					</View>

					<View className="flex-1">
						<Text className="mb-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
							GST Rate (%)
						</Text>
						<TextInput
							value={String(formData.gstRate ?? "")}
							onChangeText={(t) =>
								updateField("gstRate", Number.parseFloat(t) || 0)
							}
							keyboardType="numeric"
							placeholder="18"
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-semibold text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
						/>
					</View>
				</View>

				{/* 7. ACTION BUTTONS */}
				<View className="flex-row gap-3">
					<Pressable
						onPress={() => router.back()}
						disabled={isPending}
						className="flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white py-4 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<Text className="font-bold text-slate-700 text-sm dark:text-zinc-300">
							Cancel
						</Text>
					</Pressable>

					<Pressable
						onPress={handleSubmit}
						disabled={isPending}
						className="flex-1 items-center justify-center rounded-2xl bg-accent py-4 shadow-sm active:opacity-90 disabled:opacity-50"
					>
						{isPending ? (
							<ActivityIndicator size="small" color="#ffffff" />
						) : (
							<Text className="font-bold text-accent-foreground text-sm">
								{isEditing ? "Update Product" : "Create Product"}
							</Text>
						)}
					</Pressable>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}
