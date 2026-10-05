import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	Button,
	Card,
	Chip,
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
import { useProducts } from "@/hooks/queries/use-products";
import { useIssueStock } from "@/hooks/queries/use-worker-stock";
import type { OrganizationMember } from "@/hooks/use-organization-members";
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { authClient } from "@/lib/auth-client";
import type { Product } from "@/services/product.service";

interface CartItem {
	product: Product;
	cases: number;
	units: number;
	totalUnits: number;
}

export default function IssueStockScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();

	const { data: session } = authClient.useSession();
	const { data: productsData, isLoading: isLoadingProducts } = useProducts(
		{ page: 1, limit: 100 },
		{ enabled: !!session },
	);
	const { data: members, isLoading: isLoadingMembers } =
		useOrganizationMembers();
	const issueMutation = useIssueStock();

	const [selectedMember, setSelectedMember] =
		useState<OrganizationMember | null>(null);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [cases, setCases] = useState("");
	const [units, setUnits] = useState("");
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const products = productsData?.data || [];

	const handleMemberSelect = (member: OrganizationMember) => {
		setSelectedMember(member);
		setCart([]); // Clear cart when changing worker
	};

	const handleProductSelect = (product: Product) => {
		// Check if already in cart
		const existingItem = cart.find((item) => item.product._id === product._id);
		if (existingItem) {
			toast.show({
				variant: "warning",
				label: "Product already added. Remove it first to change quantity.",
			});
			return;
		}
		setSelectedProduct(product);
		setCases("");
		setUnits("");
	};

	const handleAddToCart = () => {
		if (!selectedProduct) {
			toast.show({ variant: "danger", label: "Please select a product" });
			return;
		}

		const casesNum = Number.parseInt(cases || "0");
		const unitsNum = Number.parseInt(units || "0");

		if (casesNum === 0 && unitsNum === 0) {
			toast.show({
				variant: "danger",
				label: "Please enter cases or units",
			});
			return;
		}

		const unitsPerCase = selectedProduct.unitsPerCase;
		const totalUnits = casesNum * unitsPerCase + unitsNum;

		// Check warehouse stock
		if (totalUnits > selectedProduct.stock) {
			toast.show({
				variant: "danger",
				label: `Insufficient stock (Available: ${selectedProduct.stock} units)`,
			});
			return;
		}

		// Add to cart
		setCart([
			...cart,
			{
				product: selectedProduct,
				cases: casesNum,
				units: unitsNum,
				totalUnits,
			},
		]);

		// Reset product selection
		setSelectedProduct(null);
		setCases("");
		setUnits("");

		toast.show({
			variant: "success",
			label: `${selectedProduct.name} added to cart`,
		});
	};

	const handleRemoveFromCart = (productId: string) => {
		setCart(cart.filter((item) => item.product._id !== productId));
	};

	const handleSubmit = async () => {
		if (!selectedMember) {
			toast.show({ variant: "danger", label: "Please select a worker" });
			return;
		}

		if (cart.length === 0) {
			toast.show({ variant: "danger", label: "Cart is empty" });
			return;
		}

		const cartSummary = cart
			.map(
				(item) =>
					`${item.product.name}: ${item.cases} cases + ${item.units} units`,
			)
			.join("\n");

		Alert.alert(
			"Confirm Issue",
			`Issue stock to ${selectedMember.user.name}?\n\n${cartSummary}`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Confirm",
					style: "default",
					onPress: async () => {
						setIsSubmitting(true);
						try {
							// Issue each product separately
							for (const item of cart) {
								await issueMutation.mutateAsync({
									workerId: selectedMember.userId,
									productId: item.product._id,
									quantity: item.totalUnits,
									cases: item.cases,
									units: item.units,
									note: note.trim() || undefined,
								});
							}

							toast.show({
								variant: "success",
								label: `Stock issued successfully! (${cart.length} products)`,
							});

							// Reset form
							setSelectedMember(null);
							setCart([]);
							setSelectedProduct(null);
							setCases("");
							setUnits("");
							setNote("");
						} catch (error: any) {
							console.error("Issue stock error:", error);
							toast.show({
								variant: "danger",
								label: error.response?.data?.message || "Failed to issue stock",
							});
						} finally {
							setIsSubmitting(false);
						}
					},
				},
			],
		);
	};

	if (isLoadingProducts || isLoadingMembers) {
		return <LoadingScreen message="Loading data..." />;
	}

	// Filter out products already in cart
	const availableProducts = products.filter(
		(p) => !cart.find((item) => item.product._id === p._id),
	);

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
					<View className="flex-1">
						<Typography variant="title1" className="text-foreground">
							Issue Stock
						</Typography>
					</View>
					{cart.length > 0 && (
						<Chip variant="accent" size="sm">
							{cart.length} items
						</Chip>
					)}
				</View>
			</View>

			<ScrollView contentContainerStyle={{ padding: 16 }}>
				{/* Step 1: Select Worker */}
				<Card className="mb-4 p-4">
					<Typography variant="title3" className="mb-3 text-foreground">
						1. Select Worker
					</Typography>

					{!members || members.length === 0 ? (
						<Typography variant="caption" className="text-foreground/60">
							No organization members found
						</Typography>
					) : (
						<View className="gap-2">
							{members.map((member) => (
								<Button
									key={member.id}
									variant={
										selectedMember?.id === member.id ? "primary" : "outline"
									}
									onPress={() => handleMemberSelect(member)}
									className="justify-start"
								>
									<View className="flex-1 flex-row items-center justify-between">
										<View>
											<Typography variant="body" className="text-left">
												{member.user.name}
											</Typography>
											<Typography variant="caption" className="text-left">
												{member.user.email}
											</Typography>
										</View>
										{selectedMember?.id === member.id && (
											<Ionicons name="checkmark-circle" size={20} />
										)}
									</View>
								</Button>
							))}
						</View>
					)}
				</Card>

				{/* Step 2: Cart */}
				{selectedMember && cart.length > 0 && (
					<Card className="mb-4 p-4">
						<View className="mb-3 flex-row items-center justify-between">
							<Typography variant="title3" className="text-foreground">
								Cart ({cart.length})
							</Typography>
							<Button
								size="sm"
								variant="ghost"
								onPress={() => setCart([])}
								className="text-danger"
							>
								Clear All
							</Button>
						</View>

						<View className="gap-2">
							{cart.map((item) => (
								<Card key={item.product._id} className="bg-surface/50">
									<View className="flex-row items-center justify-between p-3">
										<View className="flex-1">
											<Typography variant="body" className="text-foreground">
												{item.product.name}
											</Typography>
											<Typography
												variant="caption"
												className="text-foreground/60"
											>
												{item.cases} cases + {item.units} units ={" "}
												{item.totalUnits} units
											</Typography>
										</View>
										<Button
											size="sm"
											variant="ghost"
											onPress={() => handleRemoveFromCart(item.product._id)}
										>
											<Ionicons name="trash" size={16} color="#ef4444" />
										</Button>
									</View>
								</Card>
							))}
						</View>
					</Card>
				)}

				{/* Step 3: Add Products */}
				{selectedMember && (
					<Card className="mb-4 p-4">
						<Typography variant="title3" className="mb-3 text-foreground">
							{cart.length > 0 ? "3. Add More Products" : "2. Add Products"}
						</Typography>

						{/* Product Selection */}
						<View className="mb-4">
							<Label>Select Product</Label>
							{availableProducts.length === 0 ? (
								<Typography variant="caption" className="text-foreground/60">
									{cart.length > 0
										? "All products added to cart"
										: "No products available"}
								</Typography>
							) : (
								<View className="mt-2 gap-2">
									{availableProducts.map((item) => (
										<Button
											key={item._id}
											variant={
												selectedProduct?._id === item._id
													? "primary"
													: "outline"
											}
											onPress={() => handleProductSelect(item)}
											className="justify-start"
										>
											<View className="flex-1 flex-row items-center justify-between">
												<View>
													<Typography variant="body" className="text-left">
														{item.name}
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

						{/* Quantity Input */}
						{selectedProduct && (
							<>
								<Card className="mb-3 bg-accent/10">
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
										<Typography
											variant="caption"
											className="text-foreground/50"
										>
											({selectedProduct.unitsPerCase} units per case)
										</Typography>
									</View>
								</Card>

								<View className="mb-3">
									<Label>Quantity</Label>
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
												selectedProduct.unitsPerCase +
												Number.parseInt(units || "0")}{" "}
											units
										</Description>
									)}
								</View>

								<Button
									onPress={handleAddToCart}
									variant="accent"
									disabled={!cases && !units}
								>
									<Ionicons name="add" size={18} />
									<Typography variant="caption" className="ml-1">
										Add to Cart
									</Typography>
								</Button>
							</>
						)}
					</Card>
				)}

				{/* Note & Submit */}
				{selectedMember && cart.length > 0 && (
					<Card className="mb-4 p-4">
						<Typography variant="title3" className="mb-3 text-foreground">
							{availableProducts.length > 0 ? "4. Complete" : "3. Complete"}
						</Typography>

						<View className="mb-4">
							<TextField>
								<Label>Note (Optional)</Label>
								<Input
									placeholder="Purpose of issue..."
									value={note}
									onChangeText={setNote}
									multiline
									numberOfLines={3}
								/>
							</TextField>
						</View>

						<Button
							onPress={handleSubmit}
							isLoading={isSubmitting}
							disabled={cart.length === 0}
							className="w-full"
						>
							Issue {cart.length} Product(s) to {selectedMember.user.name}
						</Button>
					</Card>
				)}
			</ScrollView>
		</Container>
	);
}
