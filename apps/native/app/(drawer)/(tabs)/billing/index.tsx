import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, Input, useThemeColor } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Image,
	Linking,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { useCustomers } from "@/hooks/queries/use-customers";
import { useSales } from "@/hooks/queries/use-sales";
import type { Customer } from "@/types/customer";

export default function BillingScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const [activeSection, setActiveSection] = useState<"INVOICES" | "CUSTOMERS">(
		"INVOICES",
	);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"ALL" | "PAID" | "PARTIAL" | "PENDING"
	>("ALL");
	const [customerFilter, setCustomerFilter] = useState<
		"ALL" | "ACTIVE" | "GST"
	>("ALL");
	const [selectedCustomerAction, setSelectedCustomerAction] =
		useState<Customer | null>(null);
	const [refreshing, setRefreshing] = useState(false);

	const {
		data: salesResponse,
		isLoading: isSalesLoading,
		refetch: refetchSales,
	} = useSales({ limit: 50 });

	const {
		data: customersResponse,
		isLoading: isCustomersLoading,
		refetch: refetchCustomers,
	} = useCustomers({ limit: 100 });

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([refetchSales(), refetchCustomers()]);
		} finally {
			setRefreshing(false);
		}
	};

	const sales = salesResponse?.data || [];
	const customers = customersResponse?.data || [];

	// Filtered sales
	const filteredSales = useMemo(() => {
		return sales.filter((sale) => {
			const matchesSearch =
				!search ||
				sale.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
				sale._id.toLowerCase().includes(search.toLowerCase());

			const matchesStatus =
				statusFilter === "ALL" || sale.paymentStatus === statusFilter;

			return matchesSearch && matchesStatus;
		});
	}, [sales, search, statusFilter]);

	// Filtered customers
	const filteredCustomers = useMemo(() => {
		let list = customers.filter(
			(c) =>
				!search ||
				c.name?.toLowerCase().includes(search.toLowerCase()) ||
				c.phone?.includes(search) ||
				c.gstNumber?.toLowerCase().includes(search.toLowerCase()),
		);

		if (customerFilter === "ACTIVE") {
			list = list.filter((c) => c.isActive !== false);
		} else if (customerFilter === "GST") {
			list = list.filter((c) => !!c.gstNumber && c.gstNumber.trim().length > 0);
		}

		return list;
	}, [customers, search, customerFilter]);

	// Customer filter counts
	const customerCounts = useMemo(() => {
		const total = customers.length;
		const active = customers.filter((c) => c.isActive !== false).length;
		const gst = customers.filter(
			(c) => !!c.gstNumber && c.gstNumber.trim().length > 0,
		).length;
		return { total, active, gst };
	}, [customers]);

	// Financial Summary stats
	const stats = useMemo(() => {
		let total = 0;
		let collected = 0;
		let pending = 0;
		sales.forEach((s) => {
			total += s.total || 0;
			collected += s.paidAmount || 0;
			pending += s.pendingAmount || 0;
		});

		return { total, collected, pending, count: sales.length };
	}, [sales]);

	return (
		<Container className="flex-1 bg-white dark:bg-zinc-950">
			<View className="flex-1">
				{/* Top Section Switcher (Invoices vs Customers) */}
				<View className="px-4 pt-3 pb-2">
					<View className="flex-row rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
						<Pressable
							onPress={() => {
								setActiveSection("INVOICES");
								setSearch("");
							}}
							className={`flex-1 flex-row items-center justify-center rounded-lg py-2 ${
								activeSection === "INVOICES"
									? "bg-white shadow-sm dark:bg-zinc-700"
									: "bg-transparent"
							}`}
						>
							<Ionicons
								name="document-text"
								size={16}
								color={activeSection === "INVOICES" ? themeAccent : "#64748b"}
							/>
							<Text
								className={`ml-1.5 font-bold text-xs ${
									activeSection === "INVOICES"
										? "text-accent"
										: "text-slate-600 dark:text-zinc-400"
								}`}
							>
								Bills & Invoices
							</Text>
						</Pressable>

						<Pressable
							onPress={() => {
								setActiveSection("CUSTOMERS");
								setSearch("");
							}}
							className={`flex-1 flex-row items-center justify-center rounded-lg py-2 ${
								activeSection === "CUSTOMERS"
									? "bg-white shadow-sm dark:bg-zinc-700"
									: "bg-transparent"
							}`}
						>
							<Ionicons
								name="people"
								size={16}
								color={activeSection === "CUSTOMERS" ? "#0d9488" : "#64748b"}
							/>
							<Text
								className={`ml-1.5 font-bold text-xs ${
									activeSection === "CUSTOMERS"
										? "text-[#0d9488]"
										: "text-slate-600 dark:text-zinc-400"
								}`}
							>
								Parties & Customers
							</Text>
						</Pressable>
					</View>
				</View>

				{/* SECTION 1: INVOICES & BILLS */}
				{activeSection === "INVOICES" ? (
					<View className="flex-1">
						{/* Primary Action Buttons for Billing */}
						<View className="mb-3 flex-row gap-2.5 px-4">
							<Pressable
								onPress={() => router.push("/billing/create" as any)}
								className="flex-1 flex-row items-center justify-center rounded-xl bg-accent px-3 py-3 shadow-sm active:opacity-90"
							>
								<Ionicons name="add" size={18} color="#ffffff" />
								<Text className="ml-1 font-bold text-accent-foreground text-xs">
									Create Bill
								</Text>
							</Pressable>

							<Pressable
								onPress={() => router.push("/billing/customer-create" as any)}
								className="flex-1 flex-row items-center justify-center rounded-xl bg-slate-700 px-3 py-3 shadow-sm active:opacity-90"
							>
								<Ionicons name="person-add" size={16} color="#ffffff" />
								<Text className="ml-1 font-bold text-white text-xs">
									Add Customer
								</Text>
							</Pressable>
						</View>

						{/* Financial Summary Strip */}
						<View className="mb-3 px-4">
							<Card className="border border-slate-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
								<View className="flex-row items-center justify-between">
									<View className="flex-1 items-center">
										<Text className="font-semibold text-[10px] text-slate-500">
											Invoiced
										</Text>
										<Text className="font-bold text-slate-900 text-sm dark:text-white">
											₹{stats.total.toLocaleString("en-IN")}
										</Text>
									</View>
									<View className="h-6 w-px bg-slate-100 dark:bg-zinc-800" />
									<View className="flex-1 items-center">
										<Text className="font-semibold text-[10px] text-emerald-600">
											Collected
										</Text>
										<Text className="font-bold text-emerald-600 text-sm">
											₹{stats.collected.toLocaleString("en-IN")}
										</Text>
									</View>
									<View className="h-6 w-px bg-slate-100 dark:bg-zinc-800" />
									<View className="flex-1 items-center">
										<Text className="font-semibold text-[10px] text-amber-600">
											Pending
										</Text>
										<Text className="font-bold text-amber-600 text-sm">
											₹{stats.pending.toLocaleString("en-IN")}
										</Text>
									</View>
								</View>
							</Card>
						</View>

						{/* Search Input */}
						<View className="mb-2.5 px-4">
							<Input
								placeholder="Search invoice number..."
								value={search}
								onChangeText={setSearch}
							/>
						</View>

						{/* Status Filter Chips */}
						<View className="mb-3 flex-row gap-2 px-4">
							{(["ALL", "PAID", "PARTIAL", "PENDING"] as const).map(
								(filter) => (
									<Pressable
										key={filter}
										onPress={() => setStatusFilter(filter)}
										className={`rounded-full border px-3 py-1 ${
											statusFilter === filter
												? "border-accent bg-accent/10"
												: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
										}`}
									>
										<Text
											className={`font-semibold text-xs ${
												statusFilter === filter
													? "text-accent"
													: "text-slate-600 dark:text-zinc-400"
											}`}
										>
											{filter}
										</Text>
									</Pressable>
								),
							)}
						</View>

						{/* Invoices Scroll List */}
						<ScrollView
							className="flex-1"
							showsVerticalScrollIndicator={false}
							refreshControl={
								<RefreshControl
									refreshing={refreshing}
									onRefresh={onRefresh}
									tintColor={themeAccent}
								/>
							}
						>
							{isSalesLoading ? (
								<View className="items-center py-12">
									<ActivityIndicator size="small" color={themeAccent} />
								</View>
							) : filteredSales.length === 0 ? (
								<View className="items-center py-16">
									<Ionicons
										name="document-text-outline"
										size={36}
										color="#94a3b8"
									/>
									<Text className="mt-2 font-semibold text-slate-700 text-sm dark:text-zinc-300">
										No bills found
									</Text>
								</View>
							) : (
								<View className="gap-2.5 px-4 pb-6">
									{filteredSales.map((sale) => (
										<Card
											key={sale._id}
											className="border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
										>
											<View className="mb-1.5 flex-row items-center justify-between">
												<View className="flex-row items-center">
													<Text className="font-bold text-slate-900 text-sm dark:text-white">
														{sale.invoiceNo ||
															`#BILL-${sale._id.slice(-4).toUpperCase()}`}
													</Text>
													<View
														className={`ml-2 rounded-full px-2 py-0.5 ${
															sale.paymentStatus === "PAID"
																? "bg-emerald-100 dark:bg-emerald-950/60"
																: sale.paymentStatus === "PARTIAL"
																	? "bg-amber-100 dark:bg-amber-950/60"
																	: "bg-red-100 dark:bg-red-950/60"
														}`}
													>
														<Text
															className={`font-bold text-[10px] ${
																sale.paymentStatus === "PAID"
																	? "text-emerald-700 dark:text-emerald-400"
																	: sale.paymentStatus === "PARTIAL"
																		? "text-amber-700 dark:text-amber-400"
																		: "text-red-700 dark:text-red-400"
															}`}
														>
															{sale.paymentStatus || "PAID"}
														</Text>
													</View>
												</View>
												<Text className="font-black text-base text-slate-900 dark:text-white">
													₹{(sale.total || 0).toLocaleString("en-IN")}
												</Text>
											</View>

											<View className="flex-row items-center justify-between">
												<Text className="text-slate-500 text-xs dark:text-zinc-400">
													{sale.createdAt
														? new Date(sale.createdAt).toLocaleDateString([], {
																day: "numeric",
																month: "short",
																hour: "2-digit",
																minute: "2-digit",
															})
														: ""}
												</Text>
												{sale.pendingAmount && sale.pendingAmount > 0 ? (
													<Text className="font-semibold text-amber-600 text-xs">
														Due: ₹{sale.pendingAmount.toLocaleString("en-IN")}
													</Text>
												) : null}
											</View>
										</Card>
									))}
								</View>
							)}
						</ScrollView>
					</View>
				) : (
					/* SECTION 2: CUSTOMERS / PARTIES (Exact Product Catalog Boxy Style) */
					<View className="flex-1">
						{/* Search Bar & Add Customer Button (matches product catalog layout) */}
						<View className="flex-row items-center px-4 pt-1 pb-2">
							{/* Search Input Box */}
							<View className="mr-2 flex-1 flex-row items-center rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
								<Ionicons name="search" size={18} color="#94a3b8" />
								<TextInput
									value={search}
									onChangeText={setSearch}
									placeholder="Search customer, phone, GST..."
									placeholderTextColor="#94a3b8"
									className="ml-2 flex-1 font-medium text-slate-900 text-sm dark:text-white"
								/>
								{search.length > 0 && (
									<Pressable onPress={() => setSearch("")} hitSlop={8}>
										<Ionicons name="close-circle" size={16} color="#94a3b8" />
									</Pressable>
								)}
							</View>

							{/* Add Customer Button (matches product catalog + button) */}
							<Pressable
								onPress={() => router.push("/billing/customer-create" as any)}
								className="h-10 w-10 items-center justify-center rounded-xl bg-accent shadow-sm active:opacity-90"
								hitSlop={8}
							>
								<Ionicons name="add" size={22} color="#ffffff" />
							</Pressable>
						</View>

						{/* Horizontal Filter Chips (All, Active, GST Registered) */}
						<View className="border-slate-100 border-b pb-3 dark:border-zinc-800">
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
							>
								<Pressable
									onPress={() => setCustomerFilter("ALL")}
									className={`rounded-xl px-4 py-2 ${
										customerFilter === "ALL"
											? "bg-accent shadow-sm"
											: "border border-slate-200/80 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
									}`}
								>
									<Text
										className={`font-bold text-xs ${
											customerFilter === "ALL"
												? "text-accent-foreground"
												: "text-slate-600 dark:text-zinc-300"
										}`}
									>
										All ({customerCounts.total})
									</Text>
								</Pressable>

								<Pressable
									onPress={() => setCustomerFilter("ACTIVE")}
									className={`rounded-xl px-4 py-2 ${
										customerFilter === "ACTIVE"
											? "bg-accent shadow-sm"
											: "border border-slate-200/80 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
									}`}
								>
									<Text
										className={`font-bold text-xs ${
											customerFilter === "ACTIVE"
												? "text-accent-foreground"
												: "text-slate-600 dark:text-zinc-300"
										}`}
									>
										Active ({customerCounts.active})
									</Text>
								</Pressable>

								<Pressable
									onPress={() => setCustomerFilter("GST")}
									className={`rounded-xl px-4 py-2 ${
										customerFilter === "GST"
											? "bg-accent shadow-sm"
											: "border border-slate-200/80 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
									}`}
								>
									<Text
										className={`font-bold text-xs ${
											customerFilter === "GST"
												? "text-accent-foreground"
												: "text-slate-600 dark:text-zinc-300"
										}`}
									>
										GST Registered ({customerCounts.gst})
									</Text>
								</Pressable>
							</ScrollView>
						</View>

						{/* Customer List (Boxy list rows matching Product Catalog) */}
						<ScrollView
							className="flex-1 bg-white dark:bg-zinc-950"
							showsVerticalScrollIndicator={false}
							refreshControl={
								<RefreshControl
									refreshing={refreshing}
									onRefresh={onRefresh}
									colors={[themeAccent]}
								/>
							}
						>
							{isCustomersLoading ? (
								<View className="items-center py-12">
									<ActivityIndicator size="small" color={themeAccent} />
									<Text className="mt-3 font-semibold text-slate-400 text-xs">
										Loading customers...
									</Text>
								</View>
							) : filteredCustomers.length === 0 ? (
								<View className="items-center justify-center px-4 py-20">
									<Ionicons name="people-outline" size={48} color="#cbd5e1" />
									<Text className="mt-3 font-bold text-base text-slate-800 dark:text-zinc-200">
										No customers found
									</Text>
									<Text className="mt-1 text-center text-slate-400 text-xs">
										{search
											? `No customers match "${search}"`
											: "No customers created yet."}
									</Text>
									<Pressable
										onPress={() =>
											router.push("/billing/customer-create" as any)
										}
										className="mt-4 rounded-xl bg-accent px-4 py-2.5 shadow-sm"
									>
										<Text className="font-bold text-accent-foreground text-xs">
											+ Add Customer Now
										</Text>
									</Pressable>
								</View>
							) : (
								<View className="pb-8">
									{filteredCustomers.map((cust) => (
										<Pressable
											key={cust._id}
											onPress={() => setSelectedCustomerAction(cust)}
											className="flex-row items-center border-slate-100 border-b bg-white px-4 py-3.5 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950"
										>
											{/* 1. Left Graphic / Avatar (boxy style, matching product bottle graphic container) */}
											<View className="mr-3 h-14 w-12 items-center justify-center overflow-hidden rounded-md border border-slate-200/80 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900">
												{cust.image ? (
													<Image
														source={{ uri: cust.image }}
														className="h-full w-full"
														resizeMode="cover"
													/>
												) : (
													<View className="items-center justify-center">
														<Ionicons
															name="storefront-outline"
															size={20}
															color={themeAccent}
														/>
														<Text className="mt-0.5 font-bold text-[8px] text-slate-400 dark:text-zinc-400">
															{(cust.name || "C").slice(0, 2).toUpperCase()}
														</Text>
													</View>
												)}
											</View>

											{/* 2. Middle Customer Info */}
											<View className="flex-1 pr-2">
												<Text
													className="font-bold text-[14px] text-slate-900 dark:text-white"
													numberOfLines={1}
												>
													{cust.name}
												</Text>
												<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
													{cust.phone ? `📞 ${cust.phone}` : "No phone"}
												</Text>
												<Text
													className="mt-0.5 text-slate-400 text-xs dark:text-zinc-500"
													numberOfLines={1}
												>
													{cust.address
														? `📍 ${cust.address}`
														: cust.gstNumber
															? `GSTIN: ${cust.gstNumber}`
															: "Registered Party"}
												</Text>
											</View>

											{/* 3. Right Status Badge & Quick Actions */}
											<View className="items-end justify-between">
												<View
													className={`rounded-full px-2.5 py-0.5 ${
														cust.isActive !== false
															? "bg-emerald-50 dark:bg-emerald-950/40"
															: "bg-slate-100 dark:bg-zinc-800"
													}`}
												>
													<Text
														className={`font-bold text-[11px] ${
															cust.isActive !== false
																? "text-emerald-600 dark:text-emerald-400"
																: "text-slate-400"
														}`}
													>
														{cust.isActive !== false ? "Active" : "Inactive"}
													</Text>
												</View>

												{/* Quick Actions (Boxy icon buttons) */}
												<View className="mt-2 flex-row items-center gap-1.5">
													{cust.phone ? (
														<Pressable
															onPress={(e) => {
																e.stopPropagation();
																Linking.openURL(`tel:${cust.phone}`);
															}}
															hitSlop={6}
															className="h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 active:bg-emerald-100 dark:bg-emerald-950/60"
														>
															<Ionicons name="call" size={13} color="#10b981" />
														</Pressable>
													) : null}

													<Pressable
														onPress={(e) => {
															e.stopPropagation();
															router.push({
																pathname: "/billing/customer-create" as any,
																params: { id: cust._id },
															});
														}}
														hitSlop={6}
														className="h-7 w-7 items-center justify-center rounded-lg bg-slate-100 active:bg-slate-200 dark:bg-zinc-800"
													>
														<Ionicons name="pencil" size={13} color="#64748b" />
													</Pressable>

													<Pressable
														onPress={(e) => {
															e.stopPropagation();
															router.push({
																pathname: "/billing/create" as any,
																params: { customerId: cust._id },
															});
														}}
														hitSlop={6}
														className="h-7 w-7 items-center justify-center rounded-lg bg-accent/10 active:bg-accent/20"
													>
														<Ionicons
															name="document-text"
															size={13}
															color={themeAccent}
														/>
													</Pressable>
												</View>
											</View>
										</Pressable>
									))}
								</View>
							)}
						</ScrollView>
					</View>
				)}
			</View>

			{/* ================= MODAL: QUICK CUSTOMER ACTION SHEET (Matches Product Catalog) ================= */}
			<Modal
				visible={selectedCustomerAction !== null}
				animationType="slide"
				transparent
				onRequestClose={() => setSelectedCustomerAction(null)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<View className="rounded-t-3xl bg-white p-5 dark:bg-zinc-900">
						{selectedCustomerAction && (
							<>
								<View className="mb-3 flex-row items-center justify-between">
									<View className="flex-1 pr-2">
										<Text className="font-bold text-base text-slate-900 dark:text-white">
											{selectedCustomerAction.name}
										</Text>
										<Text className="text-slate-400 text-xs">
											{selectedCustomerAction.phone || "No phone"} •{" "}
											{selectedCustomerAction.gstNumber
												? `GST: ${selectedCustomerAction.gstNumber}`
												: "Regular Party"}
										</Text>
									</View>
									<Pressable
										onPress={() => setSelectedCustomerAction(null)}
										className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
									>
										<Ionicons name="close" size={18} color="#64748b" />
									</Pressable>
								</View>

								{/* Customer Info Snapshot Cards */}
								<View className="my-3 flex-row gap-2">
									<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
										<Text className="font-semibold text-[10px] text-slate-400">
											STATUS
										</Text>
										<Text className="font-bold text-emerald-600 text-sm dark:text-emerald-400">
											{selectedCustomerAction.isActive !== false
												? "Active"
												: "Inactive"}
										</Text>
										<Text className="text-[10px] text-slate-400">Customer</Text>
									</View>
									<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
										<Text className="font-semibold text-[10px] text-slate-400">
											GSTIN
										</Text>
										<Text
											className="font-bold text-slate-900 text-sm dark:text-white"
											numberOfLines={1}
										>
											{selectedCustomerAction.gstNumber || "N/A"}
										</Text>
										<Text className="text-[10px] text-slate-400">Tax ID</Text>
									</View>
									<View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
										<Text className="font-semibold text-[10px] text-slate-400">
											ADDRESS
										</Text>
										<Text
											className="font-bold text-slate-900 text-sm dark:text-white"
											numberOfLines={1}
										>
											{selectedCustomerAction.address || "No address"}
										</Text>
										<Text className="text-[10px] text-slate-400">Location</Text>
									</View>
								</View>

								{/* Action Buttons */}
								<View className="mt-2 gap-2">
									{/* 1. Create New Bill */}
									<Pressable
										onPress={() => {
											const custId = selectedCustomerAction._id;
											setSelectedCustomerAction(null);
											router.push({
												pathname: "/billing/create" as any,
												params: { customerId: custId },
											});
										}}
										className="flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-90"
									>
										<Ionicons name="document-text" size={18} color="#ffffff" />
										<Text className="ml-2 font-bold text-accent-foreground text-sm">
											+ Create Bill for Customer
										</Text>
									</Pressable>

									{/* 2. Call Customer */}
									{selectedCustomerAction.phone ? (
										<Pressable
											onPress={() => {
												const phone = selectedCustomerAction.phone;
												setSelectedCustomerAction(null);
												Linking.openURL(`tel:${phone}`);
											}}
											className="flex-row items-center justify-center rounded-xl bg-emerald-600 py-3 active:opacity-90"
										>
											<Ionicons name="call" size={18} color="#ffffff" />
											<Text className="ml-2 font-bold text-sm text-white">
												Call {selectedCustomerAction.phone}
											</Text>
										</Pressable>
									) : null}

									{/* 3. Edit Details */}
									<Pressable
										onPress={() => {
											const custId = selectedCustomerAction._id;
											setSelectedCustomerAction(null);
											router.push({
												pathname: "/billing/customer-create" as any,
												params: { id: custId },
											});
										}}
										className="flex-row items-center justify-center rounded-xl border border-slate-200 bg-white py-3 active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800"
									>
										<Ionicons
											name="create-outline"
											size={18}
											color={themeColorForeground}
										/>
										<Text className="ml-2 font-bold text-slate-800 text-sm dark:text-zinc-200">
											Edit Customer Details
										</Text>
									</Pressable>
								</View>
							</>
						)}
					</View>
				</View>
			</Modal>
		</Container>
	);
}
