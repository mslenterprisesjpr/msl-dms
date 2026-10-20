import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { HeroBottomSheet } from "@/components/hero-bottom-sheet";
import {
	type ReturnStockDto,
	useReturnStock,
	useWorkerStock,
	useWorkerStockByWorker,
	type WorkerStock,
} from "@/hooks/queries/use-worker-stock";
import {
	type OrganizationMember,
	useOrganizationMembers,
} from "@/hooks/use-organization-members";
import { authClient } from "@/lib/auth-client";

// Return item queued in manifest
interface ManifestItem {
	stockItem: WorkerStock;
	productId: string;
	productName: string;
	unit: string;
	unitsPerCase: number;
	cases: number;
	units: number;
	totalUnits: number;
	availableUnits: number;
	availableCases: number;
	note?: string;
}

// Case-first product info extractor
function getProductInfo(item: WorkerStock) {
	const productId =
		typeof item?.productId === "object"
			? item.productId?._id
			: item?.productId || item?._id || "";
	const name =
		item?.productName ||
		(typeof item?.productId === "object" ? item.productId?.name : "") ||
		"Unknown Product";
	const sku =
		item?.sku ||
		(typeof item?.productId === "object" ? item.productId?.sku : "") ||
		"";
	const packSize =
		item?.packSize ||
		(typeof item?.productId === "object" ? item.productId?.packSize : "") ||
		"";
	const unit =
		item?.unit ||
		(typeof item?.productId === "object" ? item.productId?.unit : "") ||
		"pcs";
	const unitsPerCase = Math.max(
		1,
		item?.unitsPerCase ||
			(typeof item?.productId === "object"
				? item.productId?.unitsPerCase || 1
				: 1),
	);
	const totalUnits = Math.max(0, item?.quantity ?? item?.stock ?? 0);
	const cases =
		item?.stockInCases ?? Math.floor(totalUnits / Math.max(1, unitsPerCase));
	const remainingUnits =
		item?.remainingUnits ?? totalUnits % Math.max(1, unitsPerCase);

	return {
		productId,
		name,
		sku,
		packSize,
		unit,
		unitsPerCase,
		totalUnits,
		cases,
		remainingUnits,
	};
}

export default function ReturnStockScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");

	const params = useLocalSearchParams<{ workerId?: string }>();
	const { data: session } = authClient.useSession();
	const currentUser = session?.user;
	const isAdmin = currentUser?.role === "admin";

	// Members list for selecting worker (if admin)
	const {
		data: members = [],
		isLoading: isLoadingMembers,
		refetch: refetchMembers,
	} = useOrganizationMembers();

	// Selected worker state
	const [selectedMember, setSelectedMember] =
		useState<OrganizationMember | null>(null);
	const [workerPickerVisible, setWorkerPickerVisible] = useState(false);
	const [workerSearch, setWorkerSearch] = useState("");

	// Initialize selected worker from params or default to current user
	useEffect(() => {
		if (members.length > 0 && !selectedMember) {
			if (params.workerId) {
				const matched = members.find((m) => m.userId === params.workerId);
				if (matched) {
					setSelectedMember(matched);
					return;
				}
			}
			const currentMember = members.find((m) => m.userId === currentUser?.id);
			setSelectedMember(currentMember || members[0]);
		}
	}, [members, params.workerId, currentUser?.id, selectedMember]);

	const effectiveWorkerId =
		selectedMember?.userId || params.workerId || currentUser?.id || "";

	// Fetch worker's active stock
	const {
		data: adminStockResponse,
		isLoading: isLoadingAdminStock,
		refetch: refetchAdminStock,
	} = useWorkerStockByWorker(effectiveWorkerId);

	const {
		data: myStockResponse,
		isLoading: isLoadingMyStock,
		refetch: refetchMyStock,
	} = useWorkerStock();

	const isLoadingStock = effectiveWorkerId
		? isLoadingAdminStock
		: isLoadingMyStock;
	const rawStockItems: WorkerStock[] =
		(effectiveWorkerId ? adminStockResponse?.data : myStockResponse?.data) ||
		[];

	// Filter items with stock > 0
	const availableStockItems = useMemo(() => {
		return rawStockItems.filter((item) => {
			const info = getProductInfo(item);
			return info.totalUnits > 0;
		});
	}, [rawStockItems]);

	const returnMutation = useReturnStock();

	// Search & State
	const [productSearch, setProductSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);

	// Active product configuration
	const [selectedStockItem, setSelectedStockItem] =
		useState<WorkerStock | null>(null);
	const [inputCases, setInputCases] = useState("");
	const [inputUnits, setInputUnits] = useState("");
	const [returnReason, setReturnReason] = useState("");

	// Manifest
	const [manifest, setManifest] = useState<ManifestItem[]>([]);
	const [isSubmittingManifest, setIsSubmittingManifest] = useState(false);

	// Pull to refresh
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([
				refetchMembers(),
				effectiveWorkerId ? refetchAdminStock() : refetchMyStock(),
			]);
		} finally {
			setRefreshing(false);
		}
	};

	// Select/Deselect product
	const handleSelectStockItem = (item: WorkerStock) => {
		if (selectedStockItem?._id === item._id) {
			setSelectedStockItem(null);
			setInputCases("");
			setInputUnits("");
			return;
		}
		setSelectedStockItem(item);
		setInputCases("");
		setInputUnits("");
		setReturnReason("");
	};

	// Active product details
	const activeProductInfo = selectedStockItem
		? getProductInfo(selectedStockItem)
		: null;
	const enteredCases = Math.max(0, Number.parseInt(inputCases || "0", 10) || 0);
	const enteredUnits = Math.max(0, Number.parseInt(inputUnits || "0", 10) || 0);
	const calculatedReturnUnits = activeProductInfo
		? enteredCases * activeProductInfo.unitsPerCase + enteredUnits
		: 0;
	const availableUnitsForActive = activeProductInfo
		? activeProductInfo.totalUnits
		: 0;
	const availableCasesForActive = activeProductInfo
		? activeProductInfo.cases
		: 0;
	const isExceeded = calculatedReturnUnits > availableUnitsForActive;
	const remainingTotalUnits = Math.max(
		0,
		availableUnitsForActive - calculatedReturnUnits,
	);
	const remainingCasesInVan = activeProductInfo
		? Math.floor(remainingTotalUnits / activeProductInfo.unitsPerCase)
		: 0;
	const remainingLooseInVan = activeProductInfo
		? remainingTotalUnits % activeProductInfo.unitsPerCase
		: 0;

	// Case Steppers
	const handleStepCase = (delta: number) => {
		if (!activeProductInfo) return;
		const nextCases = Math.max(0, enteredCases + delta);
		const maxPossibleCases = Math.floor(
			activeProductInfo.totalUnits / activeProductInfo.unitsPerCase,
		);
		setInputCases(Math.min(nextCases, maxPossibleCases).toString());
	};

	// Quick Fill Presets (Case-First)
	const handleSetCases = (num: number) => {
		if (!activeProductInfo) return;
		const maxPossible = Math.floor(
			activeProductInfo.totalUnits / activeProductInfo.unitsPerCase,
		);
		setInputCases(Math.min(num, maxPossible).toString());
	};

	const handleReturnAllCasesOnly = () => {
		if (!activeProductInfo) return;
		setInputCases(activeProductInfo.cases.toString());
		setInputUnits("0");
	};

	const handleReturnEverything = () => {
		if (!activeProductInfo) return;
		setInputCases(activeProductInfo.cases.toString());
		setInputUnits(activeProductInfo.remainingUnits.toString());
	};

	// Add to Manifest
	const handleAddToManifest = () => {
		if (!selectedStockItem || !activeProductInfo) return;

		if (calculatedReturnUnits <= 0) {
			toast.show({
				variant: "danger",
				label: "Please enter at least 1 Case to return",
			});
			return;
		}

		if (isExceeded) {
			toast.show({
				variant: "danger",
				label: `Cannot return more than available (${availableCasesForActive} Cases in van)`,
			});
			return;
		}

		const existingIndex = manifest.findIndex(
			(m) => m.productId === activeProductInfo.productId,
		);

		const newItem: ManifestItem = {
			stockItem: selectedStockItem,
			productId: activeProductInfo.productId,
			productName: activeProductInfo.name,
			unit: activeProductInfo.unit,
			unitsPerCase: activeProductInfo.unitsPerCase,
			cases: enteredCases,
			units: enteredUnits,
			totalUnits: calculatedReturnUnits,
			availableUnits: availableUnitsForActive,
			availableCases: availableCasesForActive,
			note: returnReason.trim() || undefined,
		};

		if (existingIndex >= 0) {
			const updated = [...manifest];
			updated[existingIndex] = newItem;
			setManifest(updated);
		} else {
			setManifest((prev) => [...prev, newItem]);
		}

		toast.show({
			variant: "success",
			label: `${enteredCases > 0 ? `${enteredCases} Cases` : `${enteredUnits} units`} of ${activeProductInfo.name} queued!`,
		});

		setSelectedStockItem(null);
		setInputCases("");
		setInputUnits("");
		setReturnReason("");
	};

	const handleRemoveManifestItem = (productId: string) => {
		setManifest((prev) => prev.filter((item) => item.productId !== productId));
	};

	// Direct Return
	const handleDirectReturn = async () => {
		if (!selectedStockItem || !activeProductInfo) return;

		if (calculatedReturnUnits <= 0) {
			toast.show({
				variant: "danger",
				label: "Please enter Cases to return",
			});
			return;
		}

		if (isExceeded) {
			toast.show({
				variant: "danger",
				label: `Exceeds van stock! Only ${availableCasesForActive} Cases available.`,
			});
			return;
		}

		const returnDescription =
			enteredCases > 0
				? `${enteredCases} CASE${enteredCases > 1 ? "S" : ""}${enteredUnits > 0 ? ` + ${enteredUnits} loose ${activeProductInfo.unit}` : ""}`
				: `${enteredUnits} loose ${activeProductInfo.unit}`;

		Alert.alert(
			"Confirm Case Return",
			`Return ${returnDescription} (${calculatedReturnUnits} total units) of ${activeProductInfo.name} back to warehouse?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Confirm Return",
					style: "default",
					onPress: async () => {
						try {
							await returnMutation.mutateAsync({
								productId: activeProductInfo.productId,
								workerId: effectiveWorkerId || undefined,
								cases: enteredCases,
								units: enteredUnits,
								quantity: calculatedReturnUnits,
								note: returnReason.trim() || undefined,
							});

							toast.show({
								variant: "success",
								label: `Returned ${returnDescription} to warehouse!`,
							});

							setSelectedStockItem(null);
							setInputCases("");
							setInputUnits("");
							setReturnReason("");
							if (effectiveWorkerId) {
								await refetchAdminStock();
							} else {
								await refetchMyStock();
							}
						} catch (error: any) {
							console.error("Direct return error:", error);
							toast.show({
								variant: "danger",
								label:
									error.response?.data?.message || "Failed to return stock",
							});
						}
					},
				},
			],
		);
	};

	// Submit Manifest
	const handleSubmitManifest = async () => {
		if (manifest.length === 0) return;

		const totalCases = manifest.reduce((s, m) => s + m.cases, 0);

		Alert.alert(
			"Confirm Return Batch",
			`Return ${totalCases} Total Cases across ${manifest.length} product(s) back to warehouse?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Confirm All Returns",
					style: "default",
					onPress: async () => {
						setIsSubmittingManifest(true);
						try {
							for (const item of manifest) {
								await returnMutation.mutateAsync({
									productId: item.productId,
									workerId: effectiveWorkerId || undefined,
									cases: item.cases,
									units: item.units,
									quantity: item.totalUnits,
									note: item.note,
								});
							}

							toast.show({
								variant: "success",
								label: `Successfully returned ${totalCases} Cases to warehouse!`,
							});

							setManifest([]);
							if (effectiveWorkerId) {
								await refetchAdminStock();
							} else {
								await refetchMyStock();
							}
						} catch (error: any) {
							console.error("Manifest return error:", error);
							toast.show({
								variant: "danger",
								label:
									error.response?.data?.message ||
									"Failed while processing returns",
							});
						} finally {
							setIsSubmittingManifest(false);
						}
					},
				},
			],
		);
	};

	// Filtered product items
	const filteredStockItems = useMemo(() => {
		if (!productSearch.trim()) return availableStockItems;
		const q = productSearch.toLowerCase();
		return availableStockItems.filter((item) => {
			const info = getProductInfo(item);
			return (
				info.name.toLowerCase().includes(q) ||
				info.sku.toLowerCase().includes(q) ||
				info.packSize.toLowerCase().includes(q)
			);
		});
	}, [availableStockItems, productSearch]);

	// Filtered members for modal
	const filteredMembers = useMemo(() => {
		if (!workerSearch.trim()) return members;
		const q = workerSearch.toLowerCase();
		return members.filter(
			(m) =>
				m.user.name.toLowerCase().includes(q) ||
				m.user.email.toLowerCase().includes(q) ||
				m.role.toLowerCase().includes(q),
		);
	}, [members, workerSearch]);

	// Van totals with case priority
	const vanTotals = useMemo(() => {
		let totalCases = 0;
		let totalLoose = 0;
		let totalUnits = 0;
		availableStockItems.forEach((i) => {
			const info = getProductInfo(i);
			totalCases += info.cases;
			totalLoose += info.remainingUnits;
			totalUnits += info.totalUnits;
		});
		return { totalCases, totalLoose, totalUnits };
	}, [availableStockItems]);

	const manifestTotals = useMemo(() => {
		let cases = 0;
		let loose = 0;
		manifest.forEach((m) => {
			cases += m.cases;
			loose += m.units;
		});
		return { cases, loose, count: manifest.length };
	}, [manifest]);

	return (
		<Container
			isScrollable={false}
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1"
			>
				{/* Top App Bar */}
				<View className="flex-row items-center justify-between border-slate-200 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center gap-2.5">
						<Pressable
							onPress={() => router.back()}
							className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
							hitSlop={8}
						>
							<Ionicons
								name="arrow-back"
								size={18}
								color={themeColorForeground}
							/>
						</Pressable>
						<View>
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								Return Stock to Warehouse
							</Text>
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								Case-based van offloading & warehouse restock
							</Text>
						</View>
					</View>

					<Pressable
						onPress={onRefresh}
						disabled={refreshing}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons
							name={refreshing ? "sync" : "refresh-outline"}
							size={16}
							color={themeAccent || "#0284c7"}
						/>
					</Pressable>
				</View>

				<ScrollView
					className="flex-1"
					contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={[themeAccent || "#0284c7"]}
							tintColor={themeAccent || "#0284c7"}
						/>
					}
				>
					{/* 1. WORKER CARD & FLEET SELECTION */}
					<Card className="mb-4 border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<View className="flex-1 flex-row items-center gap-3">
								<View className="h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 dark:bg-sky-500/20">
									<Ionicons name="car-outline" size={20} color="#0284c7" />
								</View>
								<View className="flex-1">
									<View className="flex-row items-center gap-2">
										<Text className="font-bold text-slate-900 text-sm dark:text-white">
											{selectedMember?.user.name ||
												currentUser?.name ||
												"Selected Worker"}
										</Text>
										<View className="rounded-md bg-sky-100 px-1.5 py-0.5 dark:bg-sky-950/40">
											<Text className="font-semibold text-[10px] text-sky-800 dark:text-sky-300">
												{selectedMember?.role || currentUser?.role || "worker"}
											</Text>
										</View>
									</View>
									<Text
										numberOfLines={1}
										className="font-medium text-[11px] text-slate-400 dark:text-zinc-500"
									>
										{selectedMember?.user.email || currentUser?.email || ""}
									</Text>
								</View>
							</View>

							{isAdmin && members.length > 1 && (
								<Pressable
									onPress={() => setWorkerPickerVisible(true)}
									className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 active:opacity-70 dark:border-zinc-700 dark:bg-zinc-800"
								>
									<Ionicons
										name="swap-horizontal"
										size={13}
										color={themeAccent || "#0284c7"}
									/>
									<Text className="font-semibold text-[11px] text-slate-700 dark:text-zinc-200">
										Change
									</Text>
								</Pressable>
							)}
						</View>

						{/* CASE-FIRST VAN INVENTORY KPI STRIP */}
						<View className="mt-3 flex-row gap-2 border-slate-100 border-t pt-3 dark:border-zinc-800/80">
							{/* 1. TOTAL CASES (HERO METRIC) */}
							<View className="flex-[1.4] rounded-2xl border border-sky-100 bg-[#f0f9ff] p-2.5 dark:border-sky-950/60 dark:bg-sky-950/20">
								<View className="flex-row items-center gap-1">
									<Ionicons name="cube" size={13} color="#0284c7" />
									<Text className="font-bold text-[11px] text-sky-800 uppercase tracking-wide dark:text-sky-300">
										Total Cases
									</Text>
								</View>
								<Text className="my-0.5 font-black text-2xl text-slate-900 tracking-tight dark:text-white">
									{vanTotals.totalCases.toLocaleString("en-IN")}{" "}
									<Text className="font-bold text-slate-500 text-xs">cs</Text>
								</Text>
								<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
									van inventory
								</Text>
							</View>

							{/* 2. LOOSE PIECES */}
							<View className="flex-1 rounded-2xl bg-slate-50 p-2.5 dark:bg-zinc-800/40">
								<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
									Loose Units
								</Text>
								<Text className="my-0.5 font-bold text-lg text-slate-800 dark:text-zinc-200">
									{vanTotals.totalLoose}{" "}
									<Text className="font-normal text-slate-400 text-xs">
										pcs
									</Text>
								</Text>
								<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
									fractional stock
								</Text>
							</View>

							{/* 3. LOADED SKUS */}
							<View className="flex-1 rounded-2xl bg-slate-50 p-2.5 dark:bg-zinc-800/40">
								<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
									SKUs Loaded
								</Text>
								<Text className="my-0.5 font-bold text-lg text-slate-800 dark:text-zinc-200">
									{availableStockItems.length}
								</Text>
								<Text className="font-medium text-[10px] text-slate-400 dark:text-zinc-500">
									products in van
								</Text>
							</View>
						</View>
					</Card>

					{/* 2. CASE-FIRST RETURN CONFIGURATOR */}
					{selectedStockItem && activeProductInfo && (
						<Card className="mb-4 border-2 border-sky-500 bg-white p-4 shadow-md dark:border-sky-500/80 dark:bg-zinc-900">
							{/* Header */}
							<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
								<View className="flex-1 pr-2">
									<View className="flex-row items-center gap-2">
										<Text className="font-bold text-base text-slate-900 dark:text-white">
											{activeProductInfo.name}
										</Text>
										<View className="rounded-md bg-sky-100 px-2 py-0.5 dark:bg-sky-950/50">
											<Text className="font-bold text-[10px] text-sky-700 dark:text-sky-300">
												{activeProductInfo.unitsPerCase}{" "}
												{activeProductInfo.unit} / Case
											</Text>
										</View>
									</View>
									<Text className="mt-0.5 font-medium text-slate-500 text-xs dark:text-zinc-400">
										Available in Van:{" "}
										<Text className="font-bold text-slate-800 dark:text-white">
											{activeProductInfo.cases} Cases
										</Text>
										{activeProductInfo.remainingUnits > 0
											? ` + ${activeProductInfo.remainingUnits} loose ${activeProductInfo.unit}`
											: ""}{" "}
										({activeProductInfo.totalUnits} total units)
									</Text>
								</View>
								<Pressable
									onPress={() => setSelectedStockItem(null)}
									className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800"
								>
									<Ionicons
										name="close"
										size={16}
										color={themeColorForeground}
									/>
								</Pressable>
							</View>

							{/* PRIMARY CASE INPUT WITH STEPPERS */}
							<View className="mt-3.5">
								<Text className="mb-1.5 font-bold text-sky-800 text-xs uppercase tracking-wider dark:text-sky-300">
									📦 Cases to Return (Primary)
								</Text>

								<View className="flex-row items-center gap-2">
									{/* Decrement Stepper */}
									<Pressable
										onPress={() => handleStepCase(-1)}
										disabled={enteredCases <= 0}
										className={`h-12 w-12 items-center justify-center rounded-2xl border active:opacity-75 ${
											enteredCases > 0
												? "border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800"
												: "border-slate-200 bg-slate-100 opacity-40 dark:border-zinc-800 dark:bg-zinc-900"
										}`}
									>
										<Ionicons
											name="remove"
											size={20}
											color={themeColorForeground}
										/>
									</Pressable>

									{/* Cases Number Display / Input */}
									<View className="flex-1 flex-row items-center justify-center rounded-2xl border-2 border-sky-500 bg-sky-50/40 px-4 py-2 dark:bg-sky-950/20">
										<TextInput
											keyboardType="numeric"
											placeholder="0"
											placeholderTextColor="#94a3b8"
											value={inputCases}
											onChangeText={setInputCases}
											className="flex-1 text-center font-black text-2xl text-slate-900 dark:text-white"
										/>
										<Text className="font-bold text-base text-sky-700 dark:text-sky-300">
											Cases
										</Text>
									</View>

									{/* Increment Stepper */}
									<Pressable
										onPress={() => handleStepCase(1)}
										disabled={
											enteredCases >=
											Math.floor(
												activeProductInfo.totalUnits /
													activeProductInfo.unitsPerCase,
											)
										}
										className="h-12 w-12 items-center justify-center rounded-2xl border border-sky-300 bg-sky-50 active:opacity-75 dark:border-sky-800 dark:bg-sky-950/40"
									>
										<Ionicons name="add" size={20} color="#0284c7" />
									</Pressable>
								</View>
							</View>

							{/* CASE QUICK PRESETS ROW */}
							<View className="mt-2.5 flex-row flex-wrap items-center gap-2">
								<Pressable
									onPress={() => handleSetCases(1)}
									className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 active:opacity-70 dark:border-zinc-700 dark:bg-zinc-800"
								>
									<Text className="font-bold text-slate-700 text-xs dark:text-zinc-200">
										+1 Case
									</Text>
								</Pressable>
								{activeProductInfo.cases >= 2 && (
									<Pressable
										onPress={() => handleSetCases(2)}
										className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 active:opacity-70 dark:border-zinc-700 dark:bg-zinc-800"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-zinc-200">
											+2 Cases
										</Text>
									</Pressable>
								)}
								{activeProductInfo.cases >= 5 && (
									<Pressable
										onPress={() => handleSetCases(5)}
										className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 active:opacity-70 dark:border-zinc-700 dark:bg-zinc-800"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-zinc-200">
											+5 Cases
										</Text>
									</Pressable>
								)}
								{activeProductInfo.cases >= 10 && (
									<Pressable
										onPress={() => handleSetCases(10)}
										className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 active:opacity-70 dark:border-zinc-700 dark:bg-zinc-800"
									>
										<Text className="font-bold text-slate-700 text-xs dark:text-zinc-200">
											+10 Cases
										</Text>
									</Pressable>
								)}
								{activeProductInfo.cases > 0 && (
									<Pressable
										onPress={handleReturnAllCasesOnly}
										className="rounded-xl bg-sky-100 px-3 py-1.5 active:opacity-70 dark:bg-sky-950/50"
									>
										<Text className="font-bold text-sky-800 text-xs dark:text-sky-300">
											All {activeProductInfo.cases} Cases
										</Text>
									</Pressable>
								)}
							</View>

							{/* SECONDARY: OPTIONAL LOOSE UNITS */}
							<View className="mt-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
								<View className="flex-row items-center justify-between">
									<View className="flex-1 pr-2">
										<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
											Optional: Loose {activeProductInfo.unit} (Fractional)
										</Text>
										<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
											Max loose: {activeProductInfo.unitsPerCase - 1}{" "}
											{activeProductInfo.unit} (1 case ={" "}
											{activeProductInfo.unitsPerCase})
										</Text>
									</View>

									{activeProductInfo.remainingUnits > 0 && (
										<Pressable
											onPress={() =>
												setInputUnits(
													activeProductInfo.remainingUnits.toString(),
												)
											}
											className="rounded-lg bg-slate-200/80 px-2 py-1 active:opacity-70 dark:bg-zinc-700"
										>
											<Text className="font-semibold text-[10px] text-slate-700 dark:text-zinc-200">
												All Loose ({activeProductInfo.remainingUnits})
											</Text>
										</Pressable>
									)}
								</View>

								<View className="mt-2 flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
									<TextInput
										keyboardType="numeric"
										placeholder="0"
										placeholderTextColor="#94a3b8"
										value={inputUnits}
										onChangeText={setInputUnits}
										className="flex-1 font-bold text-base text-slate-900 dark:text-white"
									/>
									<Text className="font-semibold text-slate-400 text-xs dark:text-zinc-500">
										loose {activeProductInfo.unit}
									</Text>
								</View>
							</View>

							{/* FULL STOCK 1-TAP ACTION */}
							<Pressable
								onPress={handleReturnEverything}
								className="mt-2 flex-row items-center justify-center gap-1.5 rounded-xl bg-amber-500/10 py-2 active:opacity-70 dark:bg-amber-500/15"
							>
								<Ionicons name="repeat" size={14} color="#d97706" />
								<Text className="font-bold text-amber-700 text-xs dark:text-amber-400">
									Return 100% Van Stock ({activeProductInfo.cases} cs +{" "}
									{activeProductInfo.remainingUnits} loose)
								</Text>
							</Pressable>

							{/* CALCULATION BANNER */}
							<View
								className={`mt-3 rounded-2xl p-3 ${
									isExceeded
										? "border border-rose-200 bg-rose-50 dark:border-rose-950/60 dark:bg-rose-950/30"
										: "bg-emerald-50 dark:bg-emerald-950/25"
								}`}
							>
								{isExceeded ? (
									<View className="flex-row items-center gap-2">
										<Ionicons name="alert-circle" size={18} color="#e11d48" />
										<Text className="flex-1 font-bold text-rose-700 text-xs dark:text-rose-400">
											Requested ({enteredCases} Cases + {enteredUnits} loose)
											exceeds van stock! Max available:{" "}
											{activeProductInfo.cases} Cases +{" "}
											{activeProductInfo.remainingUnits} loose.
										</Text>
									</View>
								) : (
									<View className="flex-row items-center justify-between">
										<View>
											<Text className="font-black text-emerald-800 text-sm dark:text-emerald-300">
												Returning: {enteredCases} CASE
												{enteredCases !== 1 ? "S" : ""}{" "}
												{enteredUnits > 0 ? `+ ${enteredUnits} loose` : ""}{" "}
												<Text className="font-medium text-emerald-700/80 text-xs">
													({calculatedReturnUnits} units)
												</Text>
											</Text>
											<Text className="mt-0.5 font-medium text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
												Remaining in van:{" "}
												<Text className="font-bold">
													{remainingCasesInVan} Cases
												</Text>
												{remainingLooseInVan > 0
													? ` + ${remainingLooseInVan} loose`
													: ""}
											</Text>
										</View>
										<Ionicons
											name="checkmark-circle"
											size={22}
											color="#10b981"
										/>
									</View>
								)}
							</View>

							{/* Optional Note */}
							<View className="mt-3">
								<Text className="mb-1 font-semibold text-slate-600 text-xs dark:text-zinc-400">
									Reason for Return (Optional)
								</Text>
								<TextInput
									placeholder="e.g. Route finished, damaged carton, client return..."
									placeholderTextColor="#94a3b8"
									value={returnReason}
									onChangeText={setReturnReason}
									className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-medium text-slate-900 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
								/>
							</View>

							{/* Actions */}
							<View className="mt-4 flex-row items-center gap-2.5">
								<Pressable
									onPress={handleAddToManifest}
									disabled={calculatedReturnUnits <= 0 || isExceeded}
									className={`flex-1 flex-row items-center justify-center rounded-2xl py-3 shadow-sm active:opacity-90 ${
										calculatedReturnUnits > 0 && !isExceeded
											? "bg-slate-900 dark:bg-white"
											: "bg-slate-200 dark:bg-zinc-800"
									}`}
								>
									<Ionicons
										name="cart-outline"
										size={16}
										color={
											calculatedReturnUnits > 0 && !isExceeded
												? "#ffffff"
												: "#94a3b8"
										}
										style={{ marginRight: 6 }}
									/>
									<Text
										className={`font-bold text-xs ${
											calculatedReturnUnits > 0 && !isExceeded
												? "text-white dark:text-slate-900"
												: "text-slate-400 dark:text-zinc-500"
										}`}
									>
										Queue to Manifest
									</Text>
								</Pressable>

								<Pressable
									onPress={handleDirectReturn}
									disabled={
										calculatedReturnUnits <= 0 ||
										isExceeded ||
										returnMutation.isPending
									}
									className={`flex-1 flex-row items-center justify-center rounded-2xl bg-sky-600 py-3 shadow-sm active:opacity-90 ${
										calculatedReturnUnits <= 0 || isExceeded ? "opacity-40" : ""
									}`}
								>
									{returnMutation.isPending ? (
										<ActivityIndicator size="small" color="#ffffff" />
									) : (
										<>
											<Ionicons
												name="arrow-down-circle"
												size={16}
												color="#ffffff"
												style={{ marginRight: 6 }}
											/>
											<Text className="font-bold text-white text-xs">
												Return Cases Now
											</Text>
										</>
									)}
								</Pressable>
							</View>
						</Card>
					)}

					{/* 3. MANIFEST QUEUE (BATCH RETURN) */}
					{manifest.length > 0 && (
						<Card className="mb-4 border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
							<View className="mb-3 flex-row items-center justify-between">
								<View className="flex-row items-center gap-2">
									<View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
										<Text className="font-bold text-white text-xs">
											{manifestTotals.cases}
										</Text>
									</View>
									<Text className="font-bold text-emerald-950 text-sm dark:text-emerald-200">
										Return Manifest ({manifestTotals.cases} Cases
										{manifestTotals.loose > 0
											? ` + ${manifestTotals.loose} loose`
											: ""}{" "}
										across {manifest.length} items)
									</Text>
								</View>
								<Pressable
									onPress={() => setManifest([])}
									className="rounded-lg px-2 py-1 active:opacity-70"
								>
									<Text className="font-semibold text-rose-600 text-xs dark:text-rose-400">
										Clear
									</Text>
								</Pressable>
							</View>

							{/* Manifest Items List */}
							<View className="gap-2">
								{manifest.map((m) => (
									<View
										key={m.productId}
										className="flex-row items-center justify-between rounded-xl border border-emerald-100 bg-white p-2.5 shadow-xs dark:border-emerald-900/40 dark:bg-zinc-900"
									>
										<View className="flex-1 pr-2">
											<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
												{m.productName}
											</Text>
											<Text className="font-bold text-emerald-700 text-xs dark:text-emerald-400">
												{m.cases} Cases{" "}
												{m.units > 0 ? `+ ${m.units} loose ${m.unit}` : ""}
												<Text className="font-medium text-[11px] text-slate-400">
													{" "}
													({m.totalUnits} units)
												</Text>
											</Text>
										</View>
										<Pressable
											onPress={() => handleRemoveManifestItem(m.productId)}
											className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 active:opacity-70 dark:bg-zinc-800"
										>
											<Ionicons
												name="trash-outline"
												size={14}
												color="#e11d48"
											/>
										</Pressable>
									</View>
								))}
							</View>

							{/* Submit Manifest Button */}
							<Pressable
								onPress={handleSubmitManifest}
								disabled={isSubmittingManifest}
								className="mt-3 flex-row items-center justify-center rounded-2xl bg-emerald-600 py-3 shadow-sm active:opacity-90"
							>
								{isSubmittingManifest ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<>
										<Ionicons
											name="checkmark-done"
											size={16}
											color="#ffffff"
											style={{ marginRight: 6 }}
										/>
										<Text className="font-bold text-white text-xs">
											Confirm Return of {manifestTotals.cases} Cases
										</Text>
									</>
								)}
							</Pressable>
						</Card>
					)}

					{/* 4. PRODUCTS IN VAN LIST (CASE-FIRST DISPLAY) */}
					<View className="mb-2 flex-row items-center justify-between">
						<Text className="font-bold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
							Van Stock by Cases ({filteredStockItems.length})
						</Text>
					</View>

					{/* Search Field */}
					<View className="mb-3 flex-row items-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
						<Ionicons
							name="search"
							size={16}
							color="#94a3b8"
							style={{ marginRight: 8 }}
						/>
						<TextInput
							placeholder="Search by product name or SKU..."
							placeholderTextColor="#94a3b8"
							value={productSearch}
							onChangeText={setProductSearch}
							className="flex-1 font-medium text-slate-900 text-xs dark:text-white"
						/>
						{productSearch.length > 0 && (
							<Pressable onPress={() => setProductSearch("")}>
								<Ionicons name="close-circle" size={16} color="#94a3b8" />
							</Pressable>
						)}
					</View>

					{/* Stock Loading State */}
					{isLoadingStock ? (
						<View className="items-center justify-center py-12">
							<ActivityIndicator
								size="large"
								color={themeAccent || "#0284c7"}
							/>
							<Text className="mt-3 font-semibold text-slate-400 text-xs dark:text-zinc-500">
								Fetching van stock cases...
							</Text>
						</View>
					) : filteredStockItems.length === 0 ? (
						<Card className="items-center justify-center border-slate-200 border-dashed bg-white py-12 dark:border-zinc-800 dark:bg-zinc-900">
							<View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
								<Ionicons name="cube-outline" size={28} color="#94a3b8" />
							</View>
							<Text className="font-bold text-base text-slate-800 dark:text-zinc-200">
								No Cases Available in Van
							</Text>
							<Text className="mt-1 max-w-[260px] text-center font-medium text-slate-400 text-xs dark:text-zinc-500">
								{productSearch
									? `No products match "${productSearch}" in this van.`
									: "This worker currently has no inventory in their van to return."}
							</Text>
							{isAdmin && (
								<Pressable
									onPress={() =>
										router.push({
											pathname: "/stock/issue" as any,
											params: { workerId: effectiveWorkerId },
										})
									}
									className="mt-4 flex-row items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 active:opacity-90"
								>
									<Ionicons name="add" size={16} color="#ffffff" />
									<Text className="font-bold text-white text-xs">
										Issue Cases to Van
									</Text>
								</Pressable>
							)}
						</Card>
					) : (
						<View className="gap-2.5">
							{filteredStockItems.map((item) => {
								const info = getProductInfo(item);
								const isSelected = selectedStockItem?._id === item._id;
								const isInManifest = manifest.some(
									(m) => m.productId === info.productId,
								);

								return (
									<Pressable
										key={item._id}
										onPress={() => handleSelectStockItem(item)}
										className="active:opacity-85"
									>
										<Card
											className={`border p-3.5 shadow-xs transition-all ${
												isSelected
													? "border-sky-500 bg-sky-50/20 dark:border-sky-500 dark:bg-sky-950/20"
													: isInManifest
														? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/80 dark:bg-emerald-950/20"
														: "border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
											}`}
										>
											<View className="flex-row items-center justify-between">
												<View className="flex-1 pr-3">
													<View className="flex-row items-center gap-2">
														<Text className="font-bold text-slate-900 text-sm dark:text-white">
															{info.name}
														</Text>
														{isInManifest && (
															<View className="rounded-md bg-emerald-100 px-1.5 py-0.5 dark:bg-emerald-950/60">
																<Text className="font-bold text-[10px] text-emerald-700 dark:text-emerald-400">
																	QUEUED
																</Text>
															</View>
														)}
													</View>

													<Text className="mt-0.5 font-medium text-[11px] text-slate-400 dark:text-zinc-500">
														{info.sku ? `SKU: ${info.sku} • ` : ""}
														{info.packSize ? `${info.packSize} • ` : ""}
														{info.unitsPerCase} {info.unit}/case
													</Text>
												</View>

												{/* CASE-FIRST STOCK BADGE */}
												<View className="items-end">
													<View className="flex-row items-center rounded-xl border border-sky-100 bg-sky-50 px-2.5 py-1 dark:border-sky-900/60 dark:bg-sky-950/40">
														<Ionicons
															name="cube"
															size={12}
															color="#0284c7"
															style={{ marginRight: 4 }}
														/>
														<Text className="font-black text-sky-900 text-sm dark:text-sky-200">
															{info.cases} cs
														</Text>
														{info.remainingUnits > 0 && (
															<Text className="ml-1 font-bold text-sky-700 text-xs dark:text-sky-300">
																+{info.remainingUnits}
															</Text>
														)}
													</View>
													<Text className="mt-0.5 font-medium text-[10px] text-slate-400 dark:text-zinc-500">
														{info.totalUnits} total {info.unit}
													</Text>
												</View>
											</View>

											{/* Bottom Quick Row */}
											<View className="mt-2.5 flex-row items-center justify-between border-slate-100 border-t pt-2 dark:border-zinc-800/60">
												<Text className="font-medium text-[11px] text-sky-600 dark:text-sky-400">
													{isSelected
														? "Tap to close options"
														: "Tap to return Cases"}
												</Text>
												<Ionicons
													name={
														isSelected
															? "chevron-up"
															: isSelected
																? "checkmark-circle"
																: "chevron-forward"
													}
													size={14}
													color="#0284c7"
												/>
											</View>
										</Card>
									</Pressable>
								);
							})}
						</View>
					)}
				</ScrollView>

				{/* 5. HEROUI NATIVE BOTTOM SHEET: WORKER PICKER (ADMIN ONLY) */}
				<HeroBottomSheet
					visible={workerPickerVisible}
					onClose={() => setWorkerPickerVisible(false)}
					title="Select Field Worker"
					subtitle="Pick a worker to inspect van stock & process return"
					snapPoints={["60%", "85%"]}
				>
					{/* Search in workers */}
					<View className="mb-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
						<Ionicons
							name="search"
							size={14}
							color="#94a3b8"
							style={{ marginRight: 6 }}
						/>
						<TextInput
							placeholder="Search worker by name or email..."
							placeholderTextColor="#94a3b8"
							value={workerSearch}
							onChangeText={setWorkerSearch}
							className="flex-1 font-medium text-slate-900 text-xs dark:text-white"
						/>
					</View>

					{/* Members list */}
					<ScrollView showsVerticalScrollIndicator={false}>
						<View className="gap-2">
							{filteredMembers.map((m) => {
								const isSelected = selectedMember?.userId === m.userId;
								return (
									<Pressable
										key={m.id}
										onPress={() => {
											setSelectedMember(m);
											setSelectedStockItem(null);
											setManifest([]);
											setWorkerPickerVisible(false);
										}}
										className={`flex-row items-center justify-between rounded-2xl border p-3 ${
											isSelected
												? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/30"
												: "border-slate-100 bg-slate-50/50 active:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/40"
										}`}
									>
										<View className="flex-row items-center gap-3">
											<View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-200/60 dark:bg-zinc-700">
												<Ionicons
													name="person"
													size={16}
													color={themeColorForeground}
												/>
											</View>
											<View>
												<Text className="font-bold text-slate-900 text-xs dark:text-white">
													{m.user.name}
												</Text>
												<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
													{m.user.email} • {m.role}
												</Text>
											</View>
										</View>
										{isSelected && (
											<Ionicons
												name="checkmark-circle"
												size={20}
												color="#0284c7"
											/>
										)}
									</Pressable>
								);
							})}
						</View>
					</ScrollView>
				</HeroBottomSheet>
			</KeyboardAvoidingView>
		</Container>
	);
}
