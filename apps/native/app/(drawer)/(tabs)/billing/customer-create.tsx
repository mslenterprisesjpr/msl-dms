import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
	Button,
	Card,
	Description,
	Input,
	Label,
	Switch,
	Typography,
	useThemeColor,
	useToast,
} from "heroui-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import {
	useCreateCustomer,
	useCustomer,
	useUpdateCustomer,
} from "@/hooks/use-customers";
import { useImageUpload } from "@/hooks/use-image-upload";
import type { CreateCustomerDto } from "@/types/customer";

export default function CustomerFormScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const router = useRouter();
	const navigation = useNavigation();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const isEditing = !!id;

	const createMutation = useCreateCustomer();
	const updateMutation = useUpdateCustomer();
	const { data: existingCustomer, isLoading: isFetching } = useCustomer(
		id || "",
	);

	const { pickImage, takePhoto, uploadToCloudinary, uploading } =
		useImageUpload();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();

	const [formData, setFormData] = useState<CreateCustomerDto>({
		name: "",
		phone: "",
		address: "",
		gstNumber: "",
		image: "",
		isActive: true,
	});

	// Set dynamic navigation title
	useEffect(() => {
		navigation.setOptions({
			title: isEditing ? "Edit Customer" : "Add Customer",
		});
	}, [isEditing, navigation]);

	// Prefill form when editing existing customer
	useEffect(() => {
		if (existingCustomer) {
			setFormData({
				name: existingCustomer.name || "",
				phone: existingCustomer.phone || "",
				address: existingCustomer.address || "",
				gstNumber: existingCustomer.gstNumber || "",
				image: existingCustomer.image || "",
				isActive:
					existingCustomer.isActive !== undefined
						? existingCustomer.isActive
						: true,
			});
		}
	}, [existingCustomer]);

	const updateField = (
		field: keyof CreateCustomerDto,
		value: string | boolean | undefined,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handlePickImage = async (source: "gallery" | "camera") => {
		try {
			const img = source === "gallery" ? await pickImage() : await takePhoto();
			if (!img) return;

			const url = await uploadToCloudinary(img.uri, "customers");
			if (url) {
				updateField("image", url);
				toast.show({
					variant: "success",
					label: "Customer photo uploaded!",
				});
			}
		} catch (error: any) {
			Alert.alert("Upload Error", error.message || "Failed to upload image");
		}
	};

	const handleSubmit = async () => {
		if (!formData.name.trim()) {
			toast.show({
				variant: "danger",
				label: "Customer name is required",
			});
			return;
		}

		try {
			const payload: CreateCustomerDto = {
				name: formData.name.trim(),
				phone: formData.phone?.trim() || undefined,
				address: formData.address?.trim() || undefined,
				gstNumber: formData.gstNumber?.trim().toUpperCase() || undefined,
				image: formData.image?.trim() || undefined,
				isActive: formData.isActive,
			};

			if (isEditing && id) {
				await updateMutation.mutateAsync({ id, data: payload });
				toast.show({
					variant: "success",
					label: "Customer updated successfully",
				});
			} else {
				await createMutation.mutateAsync(payload);
				toast.show({
					variant: "success",
					label: "Customer created successfully",
				});
			}

			router.back();
		} catch (error: unknown) {
			console.log("❌ CUSTOMER SAVE ERROR:", error);
			const errorMessage =
				error &&
				typeof error === "object" &&
				"response" in error &&
				error.response &&
				typeof error.response === "object" &&
				"data" in error.response &&
				error.response.data &&
				typeof error.response.data === "object" &&
				"message" in error.response.data
					? String(error.response.data.message)
					: isEditing
						? "Failed to update customer"
						: "Failed to create customer";

			toast.show({
				variant: "danger",
				label: errorMessage,
			});
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	if (isEditing && isFetching) {
		return (
			<Container className="items-center justify-center">
				<ActivityIndicator size="large" color="#0d9488" />
			</Container>
		);
	}

	return (
		<Container>
			<ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
				<Card className="border-border bg-surface p-4">
					{/* Customer Photo (Optional) */}
					<View className="mb-5 items-center">
						{formData.image ? (
							<View className="relative mb-3 items-center">
								<Image
									source={{ uri: formData.image }}
									className="h-28 w-28 rounded-full bg-slate-100 dark:bg-zinc-800"
									resizeMode="cover"
								/>
								<Pressable
									onPress={() => updateField("image", "")}
									className="absolute -top-1 -right-1 h-7 w-7 items-center justify-center rounded-full bg-red-500 shadow-md"
								>
									<Ionicons name="close" size={16} color="#ffffff" />
								</Pressable>
							</View>
						) : (
							<View className="mb-3 h-24 w-24 items-center justify-center rounded-full border border-slate-300 border-dashed bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900">
								<Ionicons name="person-outline" size={36} color={themeAccent} />
								<Text className="mt-1 font-medium text-[10px] text-slate-400">
									Optional Photo
								</Text>
							</View>
						)}

						{uploading ? (
							<View className="flex-row items-center gap-2 py-2">
								<ActivityIndicator size="small" color="#0d9488" />
								<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
									Uploading photo...
								</Text>
							</View>
						) : (
							<View className="flex-row gap-2">
								<Pressable
									onPress={() => handlePickImage("gallery")}
									disabled={uploading}
									className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
								>
									<Ionicons
										name="image-outline"
										size={16}
										color={themeColorForeground}
									/>
									<Text className="ml-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
										Gallery
									</Text>
								</Pressable>
								<Pressable
									onPress={() => handlePickImage("camera")}
									disabled={uploading}
									className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
								>
									<Ionicons
										name="camera-outline"
										size={16}
										color={themeColorForeground}
									/>
									<Text className="ml-1.5 font-semibold text-slate-700 text-xs dark:text-zinc-300">
										Camera
									</Text>
								</Pressable>
							</View>
						)}
					</View>

					{/* Name */}
					<View className="mb-4">
						<Label className="mb-2 text-foreground">
							<Typography className="text-foreground">
								Customer Name <Typography className="text-danger">*</Typography>
							</Typography>
						</Label>
						<Input
							placeholder="Enter customer name"
							value={formData.name}
							onChangeText={(text) => updateField("name", text)}
							className="border-border bg-surface text-foreground"
						/>
						<Description className="mt-1 text-foreground/60">
							Full name of the customer / shop
						</Description>
					</View>

					{/* Phone */}
					<View className="mb-4">
						<Label className="mb-2 text-foreground">Phone Number</Label>
						<Input
							placeholder="Enter phone number"
							value={formData.phone}
							onChangeText={(text) => updateField("phone", text)}
							keyboardType="phone-pad"
							className="border-border bg-surface text-foreground"
						/>
						<Description className="mt-1 text-foreground/60">
							Contact number for billing & invoices
						</Description>
					</View>

					{/* GST Number (Optional) */}
					<View className="mb-4">
						<Label className="mb-2 text-foreground">
							GST Number (Optional)
						</Label>
						<Input
							placeholder="e.g. 08AAAAA0000A1Z5"
							value={formData.gstNumber}
							onChangeText={(text) =>
								updateField("gstNumber", text.toUpperCase().trim())
							}
							autoCapitalize="characters"
							maxLength={15}
							className="border-border bg-surface text-foreground"
						/>
						<Description className="mt-1 text-foreground/60">
							15-digit GSTIN for billing & tax credit
						</Description>
					</View>

					{/* Address */}
					<View className="mb-4">
						<Label className="mb-2 text-foreground">Address</Label>
						<Input
							placeholder="Enter address"
							value={formData.address}
							onChangeText={(text) => updateField("address", text)}
							className="border-border bg-surface text-foreground"
							multiline
							numberOfLines={3}
						/>
						<Description className="mt-1 text-foreground/60">
							Full address / locality of the shop
						</Description>
					</View>

					{/* Active Status */}
					<View className="mb-4 flex-row items-center justify-between">
						<View className="flex-1">
							<Label className="mb-1 text-foreground">Active Status</Label>
							<Description className="text-foreground/60">
								Enable to mark customer as active
							</Description>
						</View>
						<Switch
							isSelected={formData.isActive}
							onSelectedChange={(selected) => updateField("isActive", selected)}
						/>
					</View>
				</Card>

				<View className="mt-4 mb-6 gap-3">
					<Button size="lg" onPress={handleSubmit} isDisabled={isPending}>
						{isPending
							? isEditing
								? "Updating..."
								: "Creating..."
							: isEditing
								? "Update Customer"
								: "Create Customer"}
					</Button>
					<Button variant="outline" size="lg" onPress={() => router.back()}>
						Cancel
					</Button>
				</View>
			</ScrollView>
		</Container>
	);
}
