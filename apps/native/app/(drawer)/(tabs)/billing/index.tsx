import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, Input, useThemeColor } from "heroui-native";
import React, { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";

import { Container } from "@/components/container";
import { useCustomers } from "@/hooks/queries/use-customers";
import { useSales } from "@/hooks/queries/use-sales";

export default function BillingScreen() {
	const themeAccent = useThemeColor("accent");
	const [activeSection, setActiveSection] = useState<"INVOICES" | "CUSTOMERS">(
		"INVOICES",
	);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"ALL" | "PAID" | "PARTIAL" | "PENDING"
	>("ALL");
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
		return customers.filter(
			(c) =>
				!search ||
				c.name?.toLowerCase().includes(search.toLowerCase()) ||
				c.phone?.includes(search) ||
				c.gstNumber?.toLowerCase().includes(search.toLowerCase()),
		);
	}, [customers, search]);

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
		<Container className="flex-1 bg-slate-50 dark:bg-zinc-950">
			<View className="flex-1 p-4">
				{/* Top Section Switcher (Invoices vs Customers) */}
				<View className="mb-3 flex-row rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
					<Pressable
						onPress={() => setActiveSection("INVOICES")}
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
						onPress={() => setActiveSection("CUSTOMERS")}
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

				{/* Primary Action Buttons */}
				<View className="mb-3 flex-row gap-2.5">
					<Pressable
						onPress={() => router.push("/billing/create" as any)}
						className="flex-1 flex-row items-center justify-center rounded-2xl bg-accent px-3 py-3 shadow-sm active:opacity-90"
					>
						<Ionicons name="add" size={18} color="#ffffff" />
						<Text className="ml-1 font-bold text-accent-foreground text-xs">
							Create Bill
						</Text>
					</Pressable>

					<Pressable
						onPress={() => router.push("/billing/customer-create" as any)}
						className="flex-1 flex-row items-center justify-center rounded-2xl bg-slate-700 px-3 py-3 shadow-sm active:opacity-90"
					>
						<Ionicons name="person-add" size={16} color="#ffffff" />
						<Text className="ml-1 font-bold text-white text-xs">
							Add Customer
						</Text>
					</Pressable>
				</View>

				{/* SECTION 1: INVOICES & BILLS */}
				{activeSection === "INVOICES" ? (
					<>
						{/* Financial Summary Strip */}
						<Card className="mb-3 border border-slate-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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

						{/* Search Input */}
						<View className="mb-2.5">
							<Input
								placeholder="Search invoice number..."
								value={search}
								onChangeText={setSearch}
							/>
						</View>

						{/* Status Filter Chips */}
						<View className="mb-3 flex-row gap-2">
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
								<View className="gap-2.5 pb-6">
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
					</>
				) : (
					/* SECTION 2: CUSTOMERS / PARTIES */
					<>
						{/* Search Input */}
						<View className="mb-3">
							<Input
								placeholder="Search customer name or phone..."
								value={search}
								onChangeText={setSearch}
							/>
						</View>

						<ScrollView
							className="flex-1"
							showsVerticalScrollIndicator={false}
							refreshControl={
								<RefreshControl
									refreshing={refreshing}
									onRefresh={onRefresh}
									tintColor="#0d9488"
								/>
							}
						>
							{isCustomersLoading ? (
								<View className="items-center py-12">
									<ActivityIndicator size="small" color="#0d9488" />
								</View>
							) : filteredCustomers.length === 0 ? (
								<View className="items-center py-16">
									<Ionicons name="people-outline" size={36} color="#94a3b8" />
									<Text className="mt-2 font-semibold text-slate-700 text-sm dark:text-zinc-300">
										No customers found
									</Text>
								</View>
							) : (
								<View className="gap-2.5 pb-6">
									{filteredCustomers.map((cust) => (
										<Card
											key={cust._id}
											className="border border-slate-100 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
										>
											<View className="flex-row items-center justify-between">
												<View className="flex-1 pr-2">
													<Text className="font-bold text-slate-900 text-sm dark:text-white">
														{cust.name}
													</Text>
													{cust.phone ? (
														<Text className="text-slate-500 text-xs">
															📞 {cust.phone}
														</Text>
													) : null}
													{cust.gstNumber ? (
														<Text className="mt-0.5 font-semibold text-[#0f274a] text-xs dark:text-sky-400">
															GST: {cust.gstNumber}
														</Text>
													) : null}
													{cust.address ? (
														<Text
															className="mt-0.5 text-slate-400 text-xs"
															numberOfLines={1}
														>
															📍 {cust.address}
														</Text>
													) : null}
												</View>

												<View className="flex-row items-center gap-2">
													{cust.phone ? (
														<Pressable
															onPress={() =>
																Linking.openURL(`tel:${cust.phone}`)
															}
															className="h-9 w-9 items-center justify-center rounded-full bg-emerald-50 active:bg-emerald-100 dark:bg-emerald-950/60"
														>
															<Ionicons name="call" size={16} color="#10b981" />
														</Pressable>
													) : null}

													<Pressable
														onPress={() =>
															router.push({
																pathname: "/billing/customer-create",
																params: { id: cust._id },
															} as any)
														}
														className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 dark:bg-zinc-800"
													>
														<Ionicons name="pencil" size={16} color="#0f274a" />
													</Pressable>
												</View>
											</View>
										</Card>
									))}
								</View>
							)}
						</ScrollView>
					</>
				)}
			</View>
		</Container>
	);
}
