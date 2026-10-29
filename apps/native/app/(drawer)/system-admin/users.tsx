import { Ionicons } from "@expo/vector-icons";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Alert,
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
	type SystemAdminUser,
	useSystemAdminUsers,
	useUpdateUserSystemRole,
} from "@/hooks/queries/use-system-admin";
import { useSession } from "@/lib/hooks/use-session";

export default function SystemAdminUsersScreen() {
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");
	const { toast } = useToast();
	const insets = useSafeAreaInsets();
	const { user: currentUser } = useSession();

	const [search, setSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);

	const { data: users = [], isLoading, refetch } = useSystemAdminUsers(search);

	const roleMutation = useUpdateUserSystemRole();

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	const handleToggleRole = (user: SystemAdminUser) => {
		if (user.id === currentUser?.id) {
			toast.show({
				variant: "danger",
				label: "Cannot alter your own Super Admin role",
			});
			return;
		}

		const newRole = user.role === "admin" ? "user" : "admin";
		const actionWord = newRole === "admin" ? "Promote" : "Demote";

		Alert.alert(
			`${actionWord} User Role`,
			`Are you sure you want to change ${user.name || user.email}'s system role to "${newRole.toUpperCase()}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: `Confirm ${actionWord}`,
					style: newRole === "admin" ? "default" : "destructive",
					onPress: async () => {
						try {
							await roleMutation.mutateAsync({
								userId: user.id,
								role: newRole,
							});
							toast.show({
								variant: "success",
								label: `User updated to ${newRole.toUpperCase()}`,
							});
						} catch (error: any) {
							toast.show({
								variant: "danger",
								label:
									error?.response?.data?.message || "Failed to update role",
							});
						}
					},
				},
			],
		);
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
							Global Users Directory
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							{users.length} Total registered platform users
						</Text>
					</View>

					<View className="flex-row items-center gap-1 rounded-xl bg-purple-50 px-2.5 py-1 dark:bg-purple-950/40">
						<Ionicons name="shield" size={14} color="#a855f7" />
						<Text className="font-bold text-purple-700 text-xs dark:text-purple-300">
							{users.filter((u) => u.role === "admin").length} Admins
						</Text>
					</View>
				</View>

				{/* Search bar */}
				<View className="mt-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800">
					<Ionicons name="search" size={16} color="#94a3b8" />
					<TextInput
						value={search}
						onChangeText={setSearch}
						placeholder="Search by user name or email..."
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
							Loading user directory...
						</Text>
					</View>
				) : users.length === 0 ? (
					<View className="items-center py-16">
						<Ionicons name="people-outline" size={48} color="#94a3b8" />
						<Text className="mt-3 font-bold text-base text-slate-700 dark:text-zinc-300">
							No Users Found
						</Text>
						<Text className="mt-1 font-medium text-slate-400 text-xs">
							Try adjusting your search criteria
						</Text>
					</View>
				) : (
					users.map((user) => {
						const isSysAdmin = user.role === "admin";
						const isSelf = user.id === currentUser?.id;
						const joinedDate = user.createdAt
							? new Date(user.createdAt).toLocaleDateString()
							: "Recently";

						return (
							<Card
								key={user.id}
								className={`mb-3 border p-4 shadow-sm ${
									isSysAdmin
										? "border-purple-200 bg-purple-50/20 dark:border-purple-900/40 dark:bg-purple-950/10"
										: "border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
								}`}
							>
								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<View
											className={`size-11 items-center justify-center rounded-xl ${
												isSysAdmin
													? "bg-purple-500/15"
													: "bg-slate-100 dark:bg-zinc-800"
											}`}
										>
											<Ionicons
												name={isSysAdmin ? "shield" : "person"}
												size={20}
												color={isSysAdmin ? "#a855f7" : "#64748b"}
											/>
										</View>
										<View>
											<View className="flex-row items-center gap-1.5">
												<Text className="font-bold text-base text-slate-900 dark:text-white">
													{user.name}
												</Text>
												{isSelf && (
													<View className="rounded-full bg-slate-200 px-1.5 py-0.2 dark:bg-zinc-700">
														<Text className="font-bold text-[9px] text-slate-600 dark:text-zinc-300">
															You
														</Text>
													</View>
												)}
											</View>
											<Text className="font-medium text-slate-400 text-xs dark:text-zinc-500">
												{user.email}
											</Text>
										</View>
									</View>

									<View
										className={`rounded-full px-2.5 py-0.5 ${
											isSysAdmin
												? "bg-purple-100 dark:bg-purple-900/40"
												: "bg-slate-100 dark:bg-zinc-800"
										}`}
									>
										<Text
											className={`font-bold text-[10px] uppercase ${
												isSysAdmin
													? "text-purple-700 dark:text-purple-300"
													: "text-slate-600 dark:text-zinc-400"
											}`}
										>
											{isSysAdmin ? "Super Admin" : "User"}
										</Text>
									</View>
								</View>

								{/* Organization memberships */}
								<View className="mt-3 border-slate-100 border-t pt-2.5 dark:border-zinc-800">
									<Text className="font-semibold text-[11px] text-slate-400 dark:text-zinc-500">
										Agency Memberships:
									</Text>
									{user.organizations.length > 0 ? (
										<View className="mt-1 flex-row flex-wrap gap-1.5">
											{user.organizations.map((org) => (
												<View
													key={org.organizationId}
													className="flex-row items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 dark:bg-zinc-800"
												>
													<Text className="font-medium text-[11px] text-slate-700 dark:text-zinc-300">
														🏢 {org.organizationName}
													</Text>
													<Text className="font-bold text-[9px] text-slate-400 uppercase">
														({org.role})
													</Text>
												</View>
											))}
										</View>
									) : (
										<Text className="mt-1 font-medium text-[11px] text-slate-400 italic">
											No active agency memberships
										</Text>
									)}
								</View>

								{/* Action bar */}
								<View className="mt-3 flex-row items-center justify-between border-slate-100 border-t pt-2.5 dark:border-zinc-800">
									<Text className="font-medium text-[10px] text-slate-400">
										Joined: {joinedDate}
									</Text>

									{!isSelf && (
										<Pressable
											onPress={() => handleToggleRole(user)}
											disabled={roleMutation.isPending}
											className={`rounded-lg px-3 py-1.5 active:opacity-75 ${
												isSysAdmin
													? "border border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-950/20"
													: "border border-purple-200 bg-purple-50 dark:border-purple-900/30 dark:bg-purple-950/20"
											}`}
										>
											<Text
												className={`font-bold text-[11px] ${
													isSysAdmin
														? "text-rose-700 dark:text-rose-300"
														: "text-purple-700 dark:text-purple-300"
												}`}
											>
												{isSysAdmin
													? "Demote to User"
													: "Promote to Super Admin"}
											</Text>
										</Pressable>
									)}
								</View>
							</Card>
						);
					})
				)}
			</ScrollView>
		</Container>
	);
}
