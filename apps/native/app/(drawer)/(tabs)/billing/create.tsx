import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Card, Input, useToast } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { useCustomers } from "@/hooks/queries/use-customers";
import { useProducts } from "@/hooks/queries/use-products";
import { useCreateSale } from "@/hooks/queries/use-sales";
import { useSession } from "@/lib/hooks/use-session";
import type { Product } from "@/services/product.service";

interface CartItem {
	product: Product;
	quantity: number;
}

export default function CreateBillScreen() {
	const { toast } = useToast();
	const { user } = useSession();

	const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
	const [cart, setCart] = useState<CartItem[]>([]);
	const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CREDIT">(
		"CASH",
	);
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Queries
	const { data: customersResponse } = useCustomers({ limit: 50 });
	const { data: productsResponse, isLoading: isProductsLoading } = useProducts({
		limit: 100,
		isActive: true,
	});
	const createSaleMutation = useCreateSale();

	const products = productsResponse?.data || [];
	const customers = customersResponse?.data || [];

	// Add/Increase item in cart
	const handleAddProduct = (product: Product) => {
		setCart((prev) => {
			const existing = prev.find((item) => item.product._id === product._id);
			if (existing) {
				return prev.map((item) =>
					item.product._id === product._id
						? { ...item, quantity: item.quantity + 1 }
						: item,
				);
			}
			return [...prev, { product, quantity: 1 }];
		});
	};

	// Decrease/Remove item from cart
	const handleRemoveProduct = (productId: string) => {
		setCart((prev) => {
			const existing = prev.find((item) => item.product._id === productId);
			if (existing && existing.quantity > 1) {
				return prev.map((item) =>
					item.product._id === productId
						? { ...item, quantity: item.quantity - 1 }
						: item,
				);
			}
			return prev.filter((item) => item.product._id !== productId);
		});
	};

	// Calculate totals
	const totalAmount = useMemo(() => {
		return cart.reduce((sum, item) => {
			const rate = item.product.sellingRate || 0;
			return sum + rate * item.quantity;
		}, 0);
	}, [cart]);

	// Handle Submit
	const handleSubmit = async () => {
		if (cart.length === 0) {
			toast.show({
				variant: "danger",
				label: "Please add at least 1 product to the bill",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
			const customerId = selectedCustomerId || customers[0]?._id || "WALK_IN";
			const paidAmount = paymentMethod === "CREDIT" ? 0 : totalAmount;
			const pendingAmount = paymentMethod === "CREDIT" ? totalAmount : 0;
			const paymentStatus = paymentMethod === "CREDIT" ? "PENDING" : "PAID";

			await createSaleMutation.mutateAsync({
				invoiceNo,
				customerId,
				workerId: user?.id || "DIRECT",
				total: totalAmount,
				subtotal: totalAmount,
				paidAmount,
				pendingAmount,
				paymentStatus,
				status: "CONFIRMED",
				note: note || undefined,
				createdBy: user?.id || "DIRECT",
			});

			toast.show({
				variant: "success",
				label: `Bill ${invoiceNo} generated successfully!`,
			});
			router.back();
		} catch (error: any) {
			console.error("Failed to generate bill:", error);
			toast.show({
				variant: "danger",
				label: error?.message || "Failed to generate bill",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				{/* 1. Customer Selection */}
				<Card className="mb-4 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Text className="mb-2 font-bold text-slate-900 text-sm dark:text-white">
						1. Select Customer
					</Text>
					{customers.length > 0 ? (
						<ScrollView horizontal showsHorizontalScrollIndicator={false}>
							<View className="flex-row gap-2">
								<Pressable
									onPress={() => setSelectedCustomerId("")}
									className={`rounded-xl border px-3.5 py-2 ${
										!selectedCustomerId
											? "border-[#f95a24] bg-[#f95a24]/10"
											: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
									}`}
								>
									<Text
										className={`font-bold text-xs ${
											!selectedCustomerId
												? "text-[#f95a24]"
												: "text-slate-700 dark:text-zinc-300"
										}`}
									>
										Walk-in Customer
									</Text>
								</Pressable>
								{customers.map((c) => (
									<Pressable
										key={c._id}
										onPress={() => setSelectedCustomerId(c._id)}
										className={`rounded-xl border px-3.5 py-2 ${
											selectedCustomerId === c._id
												? "border-[#f95a24] bg-[#f95a24]/10"
												: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
										}`}
									>
										<Text
											className={`font-bold text-xs ${
												selectedCustomerId === c._id
													? "text-[#f95a24]"
													: "text-slate-700 dark:text-zinc-300"
											}`}
										>
											{c.name}
										</Text>
									</Pressable>
								))}
							</View>
						</ScrollView>
					) : (
						<Text className="text-slate-400 text-xs">
							Walk-in Counter Customer
						</Text>
					)}
				</Card>

				{/* 2. Product Picker */}
				<Card className="mb-4 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Text className="mb-2 font-bold text-slate-900 text-sm dark:text-white">
						2. Add Products
					</Text>
					{isProductsLoading ? (
						<ActivityIndicator size="small" color="#f95a24" />
					) : products.length === 0 ? (
						<Text className="text-slate-400 text-xs">
							No active products available
						</Text>
					) : (
						<View className="gap-2">
							{products.slice(0, 10).map((prod) => {
								const cartItem = cart.find(
									(item) => item.product._id === prod._id,
								);
								const qty = cartItem?.quantity || 0;

								return (
									<View
										key={prod._id}
										className="flex-row items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60"
									>
										<View className="flex-1 pr-2">
											<Text className="font-semibold text-slate-900 text-sm dark:text-white">
												{prod.name}
											</Text>
											<Text className="text-slate-500 text-xs dark:text-zinc-400">
												₹{prod.sellingRate || 0} / {prod.unit || "unit"} (Stock:{" "}
												{prod.stock || 0})
											</Text>
										</View>

										{qty === 0 ? (
											<Pressable
												onPress={() => handleAddProduct(prod)}
												className="rounded-lg bg-[#f95a24] px-3 py-1.5 active:opacity-80"
											>
												<Text className="font-bold text-white text-xs">
													+ Add
												</Text>
											</Pressable>
										) : (
											<View className="flex-row items-center gap-2">
												<Pressable
													onPress={() => handleRemoveProduct(prod._id)}
													className="h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-zinc-700"
												>
													<Text className="font-bold text-slate-800 text-sm dark:text-white">
														−
													</Text>
												</Pressable>
												<Text className="w-5 text-center font-bold text-slate-900 text-sm dark:text-white">
													{qty}
												</Text>
												<Pressable
													onPress={() => handleAddProduct(prod)}
													className="h-7 w-7 items-center justify-center rounded-lg bg-[#f95a24]"
												>
													<Text className="font-bold text-sm text-white">
														+
													</Text>
												</Pressable>
											</View>
										)}
									</View>
								);
							})}
						</View>
					)}
				</Card>

				{/* 3. Cart Summary */}
				{cart.length > 0 && (
					<Card className="mb-4 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<Text className="mb-2 font-bold text-slate-900 text-sm dark:text-white">
							3. Bill Summary ({cart.length} items)
						</Text>
						<View className="gap-1.5 border-slate-100 border-b pb-2 dark:border-zinc-800">
							{cart.map((item) => (
								<View
									key={item.product._id}
									className="flex-row items-center justify-between text-xs"
								>
									<Text className="text-slate-700 text-xs dark:text-zinc-300">
										{item.product.name} × {item.quantity}
									</Text>
									<Text className="font-semibold text-slate-900 text-xs dark:text-white">
										₹{(item.product.sellingRate || 0) * item.quantity}
									</Text>
								</View>
							))}
						</View>
						<View className="mt-2.5 flex-row items-center justify-between">
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								Grand Total
							</Text>
							<Text className="font-black text-[#f95a24] text-xl">
								₹{totalAmount.toLocaleString("en-IN")}
							</Text>
						</View>
					</Card>
				)}

				{/* 4. Payment Mode */}
				<Card className="mb-6 border border-slate-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Text className="mb-2.5 font-bold text-slate-900 text-sm dark:text-white">
						4. Payment Mode
					</Text>
					<View className="flex-row gap-2.5">
						{(["CASH", "UPI", "CREDIT"] as const).map((method) => (
							<Pressable
								key={method}
								onPress={() => setPaymentMethod(method)}
								className={`flex-1 items-center justify-center rounded-xl border py-2.5 ${
									paymentMethod === method
										? "border-[#f95a24] bg-[#f95a24]/10"
										: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<Text
									className={`font-bold text-xs ${
										paymentMethod === method
											? "text-[#f95a24]"
											: "text-slate-700 dark:text-zinc-300"
									}`}
								>
									{method}
								</Text>
							</Pressable>
						))}
					</View>
				</Card>

				{/* Submit Button */}
				<Pressable
					onPress={handleSubmit}
					disabled={isSubmitting || cart.length === 0}
					className={`flex-row items-center justify-center rounded-2xl py-4 shadow-sm active:opacity-90 ${
						cart.length === 0 ? "bg-slate-300 dark:bg-zinc-800" : "bg-[#f95a24]"
					}`}
				>
					{isSubmitting ? (
						<ActivityIndicator size="small" color="#ffffff" />
					) : (
						<>
							<Ionicons name="checkmark-done" size={20} color="#ffffff" />
							<Text className="ml-2 font-bold text-base text-white">
								Generate Bill • ₹{totalAmount.toLocaleString("en-IN")}
							</Text>
						</>
					)}
				</Pressable>
			</ScrollView>
		</Container>
	);
}
