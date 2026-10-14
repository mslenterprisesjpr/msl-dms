import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	Button,
	Card,
	Description,
	Input,
	Label,
	Switch,
	Typography,
	useToast,
} from "heroui-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Container } from "@/components/container";
import { useCreateCustomer } from "@/hooks/use-customers";
import type { CreateCustomerDto } from "@/types/customer";

export default function CreateCustomerScreen() {
	const router = useRouter();
	const createMutation = useCreateCustomer();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();

	const [formData, setFormData] = useState<CreateCustomerDto>({
		name: "",
		phone: "",
		address: "",
		isActive: true,
	});

	const updateField = (
		field: keyof CreateCustomerDto,
		value: string | boolean,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
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
			await createMutation.mutateAsync(formData);
			toast.show({
				variant: "success",
				label: "Customer created successfully",
			});
			router.back();
		} catch (error: unknown) {
			console.log("❌ CREATE CUSTOMER ERROR:", error);
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
					: "Failed to create customer";

			toast.show({
				variant: "danger",
				label: errorMessage,
			});
		}
	};

	return (
		<Container>
			<View
				className="mb-4 flex-row items-center pt-4"
				style={{ paddingTop: insets.top + 16 }}
			>
				<Button
					variant="ghost"
					size="sm"
					onPress={() => router.back()}
					className="mr-2"
				>
					<Ionicons name="arrow-back" size={24} color="#888" />
				</Button>
				<Typography variant="title1" className="text-foreground">
					Add Customer
				</Typography>
			</View>

			<ScrollView className="flex-1">
				<Card className="border-border bg-surface p-4">
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
							Full name of the customer
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
							Contact number for the customer
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
							Full address of the customer
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
					<Button
						variant="solid"
						color="accent"
						size="lg"
						onPress={handleSubmit}
						isDisabled={createMutation.isPending}
					>
						{createMutation.isPending ? "Creating..." : "Create Customer"}
					</Button>
					<Button variant="outline" size="lg" onPress={() => router.back()}>
						Cancel
					</Button>
				</View>
			</ScrollView>
		</Container>
	);
}
