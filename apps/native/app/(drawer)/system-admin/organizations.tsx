import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import {
	type SystemAdminOrg,
	useSystemAdminOrganizations,
} from "@/hooks/queries/use-system-admin";
import { authClient } from "@/lib/auth-client";
import { useOrganizations } from "@/lib/hooks/use-organizations";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function SystemAdminOrganizationsScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const { toast } = useToast();
	const insets = useSafeAreaInsets();

	const [search, setSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);
	const [createModalVisible, setCreateModalVisible] = useState(false);
	const [newOrgName, setNewOrgName] = useState("");
	const [newOrgSlug, setNewOrgSlug] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const { currentOrgId, setCurrentOrg } = useOrganizationStore();
	const { refetch: refetchLocalOrgs } = useOrganizations();

	const {
		data: organizations = [],
		isLoading,
		refetch,
	} = useSystemAdminOrganizations(search);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([refetch(), refetchLocalOrgs()]);
		} finally {
			setRefreshing(false);
		}
	};

	const handleCreateOrg = async () => {
		if (!newOrgName.trim()) {
			toast.show({ variant: "danger", label: "Please enter an agency name" });
			return;
		}

		const slug =
			newOrgSlug.trim() ||
			newOrgName
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "-")
				.replace(/-+/g, "-");

		setIsCreating(true);
		try {
			const { data, error } = await authClient.organization.create({
				name: newOrgName.trim(),
				slug,
			});

			if (error) {
				toast.show({
					variant: "danger",
					label: error.message || "Failed to create organization",
				});
				return;
			}

			toast.show({
				variant: "success",
				label: `Agency "${newOrgName.trim()}" created!`,
			});

			setNewOrgName("");
			setNewOrgSlug("");
			setCreateModalVisible(false);
			await onRefresh();
		} catch (error: any) {
			toast.show({
				variant: "danger",
				label: error?.message || "Failed to create agency",
			});
		} finally {
			setIsCreating(false);
		}
	};

	const handleSwitchToOrg = (org: SystemAdminOrg) => {
		setCurrentOrg(org.id);
		toast.show({
			variant: "success",
			label: `Switched active agency to ${org.name}`,
		});
		router.replace("/(drawer)/(tabs)" as any);
	};

	return (
		<Container
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
			isScrollable={false}
		>
			{/* Top Bar */}
			<View className="border-slate-200 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
				<View className="flex-row items-center justify-between">
					<View>
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							Tenant Agencies
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							{organizations.length} Organizations registered
						</Text>
					</View>

					<Pressable
						onPress={() => setCreateModalVisible(true)}
						className="flex-row items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 active:opacity-90"
					>
						<Ionicons name="add" size={16} color="#ffffff" />
						<Text className="font-bold text-accent-foreground text-xs">
							New Agency
						</Text>
					</Pressable>
				</View>

				{/* Search bar */}
				<View className="mt-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800">
					<Ionicons name="search" size={16} color="#94a3b8" />
					<TextInput
						value={search}
						onChangeText={setSearch}
						placeholder="Search agencies by name or slug..."
						placeholderTextColor="#94a3b8"
						className="ml-2 flex-1 font-medium text-slate-900 text-xs dark:text-white"
					/>
					{search.length > 0 && (
						<Pressable onPress={() => setSearch("")}>
							<Ionicons name="close-circle" size={16} color="#94a3b8" />
						</Pressable>
					)}
				</View>
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={[themeAccent]}
						tintColor={themeAccent}
					/>
				}
			>
				{isLoading && !refreshing ? (
					<View className="items-center py-12">
						<ActivityIndicator size="large" color={themeAccent} />
						<Text className="mt-3 font-medium text-slate-400 text-xs">
							Loading agencies...
						</Text>
					</View>
				) : organizations.length === 0 ? (
					<View className="items-center py-16">
						<Ionicons name="business-outline" size={48} color="#94a3b8" />
						<Text className="mt-3 font-bold text-base text-slate-700 dark:text-zinc-300">
							No Agencies Found
						</Text>
						<Text className="mt-1 font-medium text-slate-400 text-xs">
							Try adjusting your search or create a new agency
						</Text>
					</View>
				) : (
					organizations.map((org) => {
						const isCurrent = currentOrgId === org.id;
						const createdDateStr = org.createdAt
							? new Date(org.createdAt).toLocaleDateString()
							: "Recently";

						return (
							<Card
								key={org.id}
								className={`mb-3 border p-4 shadow-sm ${
									isCurrent
										? "border-accent bg-accent/5 dark:bg-accent/10"
										: "border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<View className="size-11 items-center justify-center rounded-xl bg-blue-500/10">
											<Ionicons name="business" size={20} color="#3b82f6" />
										</View>
										<View>
											<View className="flex-row items-center gap-2">
												<Text className="font-bold text-base text-slate-900 dark:text-white">
													{org.name}
												</Text>
												{isCurrent && (
													<View className="rounded-full bg-accent px-2 py-0.5">
														<Text className="font-bold text-[9px] text-accent-foreground uppercase">
															Current
														</Text>
													</View>
												)}
											</View>
											<Text className="font-medium text-slate-400 text-xs dark:text-zinc-500">
												Slug: {org.slug || "default"} • Joined {createdDateStr}
											</Text>
										</View>
									</View>

									<View className="rounded-xl bg-slate-100 px-2.5 py-1 dark:bg-zinc-800">
										<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
											👥 {org.memberCount} Staff
										</Text>
									</View>
								</View>

								{/* Action buttons */}
								<View className="mt-3.5 flex-row items-center justify-end gap-2 border-slate-100 border-t pt-3 dark:border-zinc-800">
									<Pressable
										onPress={() => handleSwitchToOrg(org)}
										className={`flex-row items-center gap-1.5 rounded-xl px-3.5 py-2 active:opacity-85 ${
											isCurrent ? "bg-slate-200 dark:bg-zinc-700" : "bg-accent"
										}`}
									>
										<Ionicons
											name={isCurrent ? "arrow-forward" : "swap-horizontal"}
											size={14}
											color={isCurrent ? themeColorForeground : "#ffffff"}
										/>
										<Text
											className={`font-bold text-xs ${
												isCurrent
													? "text-slate-800 dark:text-zinc-200"
													: "text-accent-foreground"
											}`}
										>
											{isCurrent
												? "Enter Agency DMS →"
												: "Switch to This Agency"}
										</Text>
									</Pressable>
								</View>
							</Card>
						);
					})
				)}
			</ScrollView>

			{/* Modal to Create Organization */}
			<Modal
				visible={createModalVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setCreateModalVisible(false)}
			>
				<View className="flex-1 items-center justify-center bg-black/50 p-5">
					<Card className="w-full max-w-sm border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<Text className="font-bold text-lg text-slate-900 dark:text-white">
								Create New Agency
							</Text>
							<Pressable
								onPress={() => setCreateModalVisible(false)}
								className="size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800"
							>
								<Ionicons name="close" size={18} color="#94a3b8" />
							</Pressable>
						</View>

						<Text className="mt-1 font-medium text-slate-400 text-xs dark:text-zinc-500">
							Add a new distribution agency / tenant to the platform.
						</Text>

						<View className="mt-4 gap-3">
							<View>
								<Text className="mb-1 font-semibold text-slate-700 text-xs dark:text-zinc-300">
									Agency Name *
								</Text>
								<TextInput
									value={newOrgName}
									onChangeText={setNewOrgName}
									placeholder="e.g. Royal Enterprise Jaipur"
									placeholderTextColor="#94a3b8"
									className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-slate-900 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
								/>
							</View>

							<View>
								<Text className="mb-1 font-semibold text-slate-700 text-xs dark:text-zinc-300">
									Slug (Optional)
								</Text>
								<TextInput
									value={newOrgSlug}
									onChangeText={setNewOrgSlug}
									placeholder="e.g. royal-jaipur"
									placeholderTextColor="#94a3b8"
									autoCapitalize="none"
									className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-slate-900 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
								/>
							</View>
						</View>

						<View className="mt-5 flex-row gap-2">
							<Pressable
								onPress={() => setCreateModalVisible(false)}
								className="flex-1 items-center rounded-xl bg-slate-100 py-3 active:opacity-80 dark:bg-zinc-800"
							>
								<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
									Cancel
								</Text>
							</Pressable>

							<Pressable
								onPress={handleCreateOrg}
								disabled={isCreating}
								className="flex-1 items-center rounded-xl bg-accent py-3 active:opacity-90"
							>
								{isCreating ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Text className="font-bold text-accent-foreground text-xs">
										Create Agency
									</Text>
								)}
							</Pressable>
						</View>
					</Card>
				</View>
			</Modal>
		</Container>
	);
}
