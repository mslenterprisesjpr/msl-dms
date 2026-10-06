import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
	Button,
	Card,
	Chip,
	Description,
	Input,
	Label,
	Surface,
	TextField,
	Typography,
	useThemeColor,
} from "heroui-native";
import React, { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/hooks/use-session";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function ProfileScreen() {
	const { session, refetch } = useSession();
	const user = session?.user;

	// Organizations
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const organizations = useOrganizationStore((state) => state.organizations);
	const currentOrg =
		organizations.find((org) => org.id === currentOrgId) || null;

	// Theme colors
	const themeForeground = useThemeColor("foreground");
	const themePrimary = useThemeColor("primary");

	// Refresh state
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Edit Profile Modal
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editName, setEditName] = useState(user?.name || "");
	const [isSavingProfile, setIsSavingProfile] = useState(false);

	// Change Password Modal
	const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	// Sign out state
	const [isSigningOut, setIsSigningOut] = useState(false);

	// Refresh handler
	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			await refetch();
		} catch (error) {
			console.error("Failed to refresh session:", error);
		} finally {
			setIsRefreshing(false);
		}
	};

	// Open Edit Modal
	const handleOpenEditModal = () => {
		setEditName(user?.name || "");
		setIsEditModalOpen(true);
	};

	// Submit Profile Update
	const handleSaveProfile = async () => {
		const trimmedName = editName.trim();
		if (!trimmedName) {
			Alert.alert("Validation Error", "Name cannot be empty.");
			return;
		}

		setIsSavingProfile(true);
		try {
			let updateSuccess = false;

			// Better Auth base client updateUser
			try {
				if (typeof (authClient as any).updateUser === "function") {
					const { error } = await (authClient as any).updateUser({
						name: trimmedName,
					});
					if (!error) {
						updateSuccess = true;
					} else {
						console.warn("authClient.updateUser returned error:", error);
					}
				}
			} catch (err) {
				console.warn("authClient.updateUser failed:", err);
			}

			// Fallback to admin.updateUser if available
			if (!updateSuccess && user?.id && (authClient as any).admin?.updateUser) {
				const { error } = await (authClient as any).admin.updateUser({
					userId: user.id,
					data: {
						name: trimmedName,
					},
				});
				if (!error) {
					updateSuccess = true;
				} else {
					throw new Error(error.message || "Failed to update profile");
				}
			}

			if (updateSuccess) {
				Alert.alert("Success", "Your profile has been updated.");
				setIsEditModalOpen(false);
				await refetch();
			} else {
				Alert.alert("Error", "Could not update profile. Please try again.");
			}
		} catch (error: any) {
			console.error("Save profile error:", error);
			Alert.alert("Error", error?.message || "Failed to update profile.");
		} finally {
			setIsSavingProfile(false);
		}
	};

	// Submit Password Change
	const handleChangePassword = async () => {
		if (!currentPassword) {
			Alert.alert("Validation Error", "Please enter your current password.");
			return;
		}
		if (!newPassword || newPassword.length < 8) {
			Alert.alert(
				"Validation Error",
				"New password must be at least 8 characters long.",
			);
			return;
		}
		if (newPassword !== confirmPassword) {
			Alert.alert(
				"Validation Error",
				"New password and confirm password do not match.",
			);
			return;
		}

		setIsChangingPassword(true);
		try {
			if (typeof (authClient as any).changePassword === "function") {
				const { error } = await (authClient as any).changePassword({
					currentPassword,
					newPassword,
					revokeOtherSessions: true,
				});

				if (error) {
					Alert.alert("Error", error.message || "Failed to change password.");
					return;
				}

				Alert.alert("Success", "Your password has been changed successfully.");
				setIsPasswordModalOpen(false);
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
			} else if (user?.id && (authClient as any).admin?.setUserPassword) {
				// Admin fallback
				const { error } = await (authClient as any).admin.setUserPassword({
					userId: user.id,
					newPassword,
				});

				if (error) {
					Alert.alert("Error", error.message || "Failed to change password.");
					return;
				}

				Alert.alert("Success", "Password updated successfully.");
				setIsPasswordModalOpen(false);
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
			} else {
				Alert.alert(
					"Not Supported",
					"Password change is not available in this configuration.",
				);
			}
		} catch (error: any) {
			console.error("Change password error:", error);
			Alert.alert("Error", error?.message || "Failed to change password.");
		} finally {
			setIsChangingPassword(false);
		}
	};

	// Sign Out Handler
	const handleSignOut = () => {
		Alert.alert(
			"Sign Out",
			"Are you sure you want to sign out of your account?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Sign Out",
					style: "destructive",
					onPress: async () => {
						setIsSigningOut(true);
						try {
							await authClient.signOut();
							router.replace("/(drawer)/second");
						} catch (error) {
							console.error("Sign out error:", error);
							Alert.alert("Error", "Failed to sign out. Please try again.");
						} finally {
							setIsSigningOut(false);
						}
					},
				},
			],
		);
	};

	// Helper for user initials
	const getInitials = (name?: string, email?: string): string => {
		if (name && name.trim()) {
			const parts = name.trim().split(" ");
			if (parts.length >= 2) {
				return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
			}
			return name.slice(0, 2).toUpperCase();
		}
		if (email && email.trim()) {
			return email.slice(0, 2).toUpperCase();
		}
		return "U";
	};

	// Helper for member since date
	const formatMemberSince = (dateVal?: string | Date): string => {
		if (!dateVal) return "Recently";
		try {
			const d = new Date(dateVal);
			return d.toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		} catch {
			return "Recently";
		}
	};

	const userInitials = getInitials(user?.name, user?.email);
	const isAdmin = user?.role === "admin" || user?.role === "owner";

	return (
		<Container>
			<View className="flex-1">
				{/* Top App Bar with Back Button */}
				<View className="border-border border-b bg-surface px-4 py-3">
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-3">
							<Pressable
								onPress={() => router.back()}
								className="h-10 w-10 items-center justify-center rounded-full bg-default-100 active:opacity-70"
								hitSlop={8}
							>
								<Ionicons name="arrow-back" size={20} color={themeForeground} />
							</Pressable>
							<View>
								<Typography type="h3" className="font-bold text-foreground">
									My Profile
								</Typography>
								<Typography type="body-xs" className="text-foreground/60">
									Account settings & details
								</Typography>
							</View>
						</View>

						<Pressable
							onPress={handleRefresh}
							className="h-10 w-10 items-center justify-center rounded-full bg-default-100 active:opacity-70"
							hitSlop={8}
						>
							<Ionicons
								name="refresh-outline"
								size={20}
								color={themeForeground}
							/>
						</Pressable>
					</View>
				</View>

				{/* Scrollable Content */}
				<ScrollView
					className="flex-1"
					contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={handleRefresh}
						/>
					}
				>
					{/* Hero Profile Card */}
					<Card className="mb-4 overflow-hidden border border-border/60">
						<View className="bg-primary/10 px-5 pt-6 pb-5">
							<View className="flex-row items-center gap-4">
								{/* Avatar circle */}
								<View className="relative">
									<View className="h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/20 shadow-sm">
										<Text className="font-extrabold text-2xl text-primary">
											{userInitials}
										</Text>
									</View>
									{/* Active online dot */}
									<View className="absolute right-0 bottom-0 h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-success">
										<View className="h-2 w-2 rounded-full bg-white" />
									</View>
								</View>

								{/* User identity & roles */}
								<View className="flex-1">
									<Typography
										type="h3"
										className="font-bold text-foreground"
										numberOfLines={1}
									>
										{user?.name || "System User"}
									</Typography>
									<Typography
										type="body-xs"
										className="mt-0.5 text-foreground/70"
										numberOfLines={1}
									>
										{user?.email || "No email linked"}
									</Typography>

									{/* Badges */}
									<View className="mt-2.5 flex-row flex-wrap items-center gap-2">
										{isAdmin ? (
											<Chip variant="soft" color="warning" size="sm">
												<View className="flex-row items-center gap-1">
													<Ionicons
														name="shield-checkmark"
														size={12}
														color="#f59e0b"
													/>
													<Text className="font-semibold text-warning text-xs">
														Admin
													</Text>
												</View>
											</Chip>
										) : (
											<Chip variant="secondary" color="default" size="sm">
												<Text className="text-foreground/70 text-xs">
													Member
												</Text>
											</Chip>
										)}

										<Chip variant="soft" color="success" size="sm">
											<Text className="font-medium text-success text-xs">
												Active
											</Text>
										</Chip>
									</View>
								</View>
							</View>
						</View>

						{/* Quick action strip */}
						<View className="border-border/40 border-t bg-surface/50 p-3">
							<Button
								variant="secondary"
								size="sm"
								className="w-full"
								onPress={handleOpenEditModal}
							>
								<Ionicons
									name="create-outline"
									size={16}
									color={themeForeground}
								/>
								<Text className="ml-1.5 font-semibold text-foreground text-sm">
									Edit Display Name
								</Text>
							</Button>
						</View>
					</Card>

					{/* Personal Details Section */}
					<View className="mb-2">
						<Text className="mb-2 ml-1 font-bold text-foreground/60 text-xs uppercase tracking-wider">
							Personal Information
						</Text>

						<Card className="mb-4">
							<View className="divide-y divide-border/60">
								{/* Name item */}
								<View className="flex-row items-center justify-between p-4">
									<View className="flex-1">
										<Typography type="body-xs" className="text-foreground/60">
											Full Name
										</Typography>
										<Typography
											type="body"
											className="mt-0.5 font-semibold text-foreground"
										>
											{user?.name || "Not set"}
										</Typography>
									</View>
									<Pressable
										onPress={handleOpenEditModal}
										className="h-8 w-8 items-center justify-center rounded-full bg-default-100 active:opacity-70"
										hitSlop={8}
									>
										<Ionicons name="pencil" size={14} color={themeForeground} />
									</Pressable>
								</View>

								{/* Email item */}
								<View className="flex-row items-center justify-between p-4">
									<View className="flex-1">
										<Typography type="body-xs" className="text-foreground/60">
											Email Address
										</Typography>
										<Typography
											type="body"
											className="mt-0.5 font-semibold text-foreground"
										>
											{user?.email || "—"}
										</Typography>
									</View>
									<Ionicons
										name="mail-outline"
										size={18}
										color={themeForeground}
										style={{ opacity: 0.5 }}
									/>
								</View>

								{/* User ID item */}
								<View className="flex-row items-center justify-between p-4">
									<View className="flex-1 pr-2">
										<Typography type="body-xs" className="text-foreground/60">
											User Identifier
										</Typography>
										<Text
											className="mt-0.5 font-mono text-foreground/80 text-xs"
											numberOfLines={1}
										>
											{user?.id || "—"}
										</Text>
									</View>
									<Pressable
										onPress={() => {
											if (user?.id) {
												Alert.alert("User ID", user.id);
											}
										}}
										className="h-8 items-center justify-center rounded-lg bg-default-100 px-2.5 active:opacity-70"
									>
										<Text className="font-medium text-foreground text-xs">
											View ID
										</Text>
									</Pressable>
								</View>

								{/* Joined Date */}
								<View className="flex-row items-center justify-between p-4">
									<View className="flex-1">
										<Typography type="body-xs" className="text-foreground/60">
											Member Since
										</Typography>
										<Typography
											type="body"
											className="mt-0.5 font-medium text-foreground"
										>
											{formatMemberSince((user as any)?.createdAt)}
										</Typography>
									</View>
									<Ionicons
										name="calendar-outline"
										size={18}
										color={themeForeground}
										style={{ opacity: 0.5 }}
									/>
								</View>
							</View>
						</Card>
					</View>

					{/* Current Organization Section */}
					<View className="mb-2">
						<Text className="mb-2 ml-1 font-bold text-foreground/60 text-xs uppercase tracking-wider">
							Organization
						</Text>

						<Card className="mb-4">
							<View className="p-4">
								<View className="flex-row items-center">
									<View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
										<Ionicons name="business" size={24} color={themePrimary} />
									</View>
									<View className="flex-1">
										<Typography
											type="body"
											className="font-bold text-foreground"
										>
											{currentOrg?.name || "No Organization Selected"}
										</Typography>
										<Typography type="body-xs" className="text-foreground/60">
											{currentOrg
												? `@${currentOrg.slug}`
												: "Select or create one to collaborate"}
										</Typography>
									</View>
								</View>

								<View className="mt-4 flex-row gap-2">
									<Button
										variant="secondary"
										size="sm"
										className="flex-1"
										onPress={() => router.push("/organizations")}
									>
										<Ionicons
											name="swap-horizontal"
											size={16}
											color={themeForeground}
										/>
										<Text className="ml-1.5 font-semibold text-foreground text-sm">
											Switch / Manage
										</Text>
									</Button>
								</View>
							</View>
						</Card>
					</View>

					{/* Security & Authentication */}
					<View className="mb-2">
						<Text className="mb-2 ml-1 font-bold text-foreground/60 text-xs uppercase tracking-wider">
							Security & Credentials
						</Text>

						<Card className="mb-4">
							<View className="divide-y divide-border/60">
								{/* Change Password */}
								<Pressable
									onPress={() => setIsPasswordModalOpen(true)}
									className="flex-row items-center justify-between p-4 active:bg-default-100"
								>
									<View className="flex-row items-center gap-3">
										<View className="h-10 w-10 items-center justify-center rounded-full bg-warning/10">
											<Ionicons name="lock-closed" size={20} color="#f59e0b" />
										</View>
										<View>
											<Typography
												type="body"
												className="font-semibold text-foreground"
											>
												Change Password
											</Typography>
											<Typography type="body-xs" className="text-foreground/60">
												Update your login password securely
											</Typography>
										</View>
									</View>
									<Ionicons
										name="chevron-forward"
										size={18}
										color={themeForeground}
										style={{ opacity: 0.5 }}
									/>
								</Pressable>

								{/* Multi-Device Sessions */}
								<View className="flex-row items-center justify-between p-4">
									<View className="flex-row items-center gap-3">
										<View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
											<Ionicons
												name="phone-portrait-outline"
												size={20}
												color="#10b981"
											/>
										</View>
										<View>
											<Typography
												type="body"
												className="font-semibold text-foreground"
											>
												Current Device
											</Typography>
											<Typography type="body-xs" className="text-foreground/60">
												Active session on mobile
											</Typography>
										</View>
									</View>
									<Chip variant="soft" color="success" size="sm">
										<Text className="font-semibold text-success text-xs">
											Online
										</Text>
									</Chip>
								</View>
							</View>
						</Card>
					</View>

					{/* Sign Out Section */}
					<View className="mt-2 mb-6">
						<Button
							variant="danger"
							className="w-full py-3.5"
							onPress={handleSignOut}
							disabled={isSigningOut}
						>
							{isSigningOut ? (
								<ActivityIndicator size="small" color="#ffffff" />
							) : (
								<View className="flex-row items-center justify-center gap-2">
									<Ionicons name="log-out-outline" size={20} color="#ffffff" />
									<Text className="font-bold text-base text-white">
										Sign Out
									</Text>
								</View>
							)}
						</Button>
					</View>
				</ScrollView>

				{/* Edit Profile Modal */}
				<BottomSheetModal
					visible={isEditModalOpen}
					onClose={() => setIsEditModalOpen(false)}
					title="Edit Profile"
					subtitle="Update your personal display details"
					footer={
						<View className="flex-row gap-3">
							<Button
								variant="secondary"
								className="flex-1"
								onPress={() => setIsEditModalOpen(false)}
								disabled={isSavingProfile}
							>
								<Text className="text-foreground">Cancel</Text>
							</Button>
							<Button
								variant="primary"
								className="flex-1"
								onPress={handleSaveProfile}
								disabled={isSavingProfile}
							>
								{isSavingProfile ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Text className="font-semibold text-white">Save Changes</Text>
								)}
							</Button>
						</View>
					}
				>
					<View className="gap-4">
						<TextField>
							<Label>Display Name</Label>
							<Input
								placeholder="Enter your full name"
								value={editName}
								onChangeText={setEditName}
								autoCapitalize="words"
							/>
							<Description>
								This name will be displayed across organizations and team lists.
							</Description>
						</TextField>

						<TextField>
							<Label>Email</Label>
							<Input
								value={user?.email || ""}
								editable={false}
								className="opacity-60"
							/>
							<Description>
								Email address cannot be changed from this screen.
							</Description>
						</TextField>
					</View>
				</BottomSheetModal>

				{/* Change Password Modal */}
				<BottomSheetModal
					visible={isPasswordModalOpen}
					onClose={() => setIsPasswordModalOpen(false)}
					title="Change Password"
					subtitle="Set a secure new password for your account"
					footer={
						<View className="flex-row gap-3">
							<Button
								variant="secondary"
								className="flex-1"
								onPress={() => setIsPasswordModalOpen(false)}
								disabled={isChangingPassword}
							>
								<Text className="text-foreground">Cancel</Text>
							</Button>
							<Button
								variant="primary"
								className="flex-1"
								onPress={handleChangePassword}
								disabled={isChangingPassword}
							>
								{isChangingPassword ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Text className="font-semibold text-white">
										Update Password
									</Text>
								)}
							</Button>
						</View>
					}
				>
					<View className="gap-4">
						{/* Current Password */}
						<TextField>
							<Label>Current Password</Label>
							<View className="relative justify-center">
								<Input
									placeholder="Enter current password"
									value={currentPassword}
									onChangeText={setCurrentPassword}
									secureTextEntry={!showCurrentPassword}
									autoCapitalize="none"
								/>
								<Pressable
									onPress={() => setShowCurrentPassword(!showCurrentPassword)}
									className="absolute right-3 p-1"
								>
									<Ionicons
										name={
											showCurrentPassword ? "eye-off-outline" : "eye-outline"
										}
										size={20}
										color={themeForeground}
									/>
								</Pressable>
							</View>
						</TextField>

						{/* New Password */}
						<TextField>
							<Label>New Password</Label>
							<View className="relative justify-center">
								<Input
									placeholder="Minimum 8 characters"
									value={newPassword}
									onChangeText={setNewPassword}
									secureTextEntry={!showNewPassword}
									autoCapitalize="none"
								/>
								<Pressable
									onPress={() => setShowNewPassword(!showNewPassword)}
									className="absolute right-3 p-1"
								>
									<Ionicons
										name={showNewPassword ? "eye-off-outline" : "eye-outline"}
										size={20}
										color={themeForeground}
									/>
								</Pressable>
							</View>
							<Description>
								Use at least 8 characters with a mix of letters and numbers.
							</Description>
						</TextField>

						{/* Confirm New Password */}
						<TextField>
							<Label>Confirm New Password</Label>
							<View className="relative justify-center">
								<Input
									placeholder="Re-enter new password"
									value={confirmPassword}
									onChangeText={setConfirmPassword}
									secureTextEntry={!showConfirmPassword}
									autoCapitalize="none"
								/>
								<Pressable
									onPress={() => setShowConfirmPassword(!showConfirmPassword)}
									className="absolute right-3 p-1"
								>
									<Ionicons
										name={
											showConfirmPassword ? "eye-off-outline" : "eye-outline"
										}
										size={20}
										color={themeForeground}
									/>
								</Pressable>
							</View>
						</TextField>
					</View>
				</BottomSheetModal>
			</View>
		</Container>
	);
}
