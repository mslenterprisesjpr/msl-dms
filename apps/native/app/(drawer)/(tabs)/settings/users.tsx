import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
	Button,
	Card,
	Chip,
	Description,
	Input,
	Label,
	Select,
	Surface,
	TextField,
	Typography,
} from "heroui-native";
import { useEffect, useState } from "react";
import {
	Alert,
	Pressable,
	RefreshControl,
	ScrollView,
	View,
} from "react-native";
import { Container } from "@/components/container";
import { DialogModal } from "@/components/dialog-modal";
import { LoadingScreen } from "@/components/loading-screen";
import { authClient } from "@/lib/auth-client";

interface User {
	id: string;
	name: string;
	email: string;
	createdAt: string;
	banned?: boolean;
	banReason?: string;
	banExpires?: number;
}

export default function UserManagementScreen() {
	const [users, setUsers] = useState<User[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [hasMore, setHasMore] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [currentOffset, setCurrentOffset] = useState(0);
	const PAGE_SIZE = 20;

	// Modal states
	const [showModal, setShowModal] = useState(false);
	const [modalMode, setModalMode] = useState<
		"create" | "edit" | "password" | "ban"
	>("create");
	const [selectedUser, setSelectedUser] = useState<User | null>(null);

	// Form states
	const [userName, setUserName] = useState("");
	const [userEmail, setUserEmail] = useState("");
	const [userPassword, setUserPassword] = useState("");
	const [banReason, setBanReason] = useState("");
	const [banDuration, setBanDuration] = useState(""); // in days
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Fetch users with pagination
	const fetchUsers = async (refresh = false, loadMore = false) => {
		if (refresh) {
			setIsRefreshing(true);
			setCurrentOffset(0);
		} else if (loadMore) {
			setIsLoadingMore(true);
		} else {
			setIsLoading(true);
		}

		try {
			const offset = refresh ? 0 : loadMore ? currentOffset : 0;

			const { data, error } = await authClient.admin.listUsers({
				query: {
					limit: PAGE_SIZE,
					offset: offset,
					searchValue: searchQuery || undefined,
					searchField: "name",
				},
			});

			if (error) {
				Alert.alert("Error", error.message || "Failed to fetch users");
				if (!loadMore) setUsers([]);
			} else {
				const newUsers = data?.users || [];

				if (refresh || !loadMore) {
					setUsers(newUsers);
				} else {
					setUsers((prev) => [...prev, ...newUsers]);
				}

				// Check if there are more users
				setHasMore(newUsers.length === PAGE_SIZE);

				// Update offset for next load
				if (loadMore) {
					setCurrentOffset(offset + PAGE_SIZE);
				} else {
					setCurrentOffset(PAGE_SIZE);
				}
			}
		} catch (error) {
			console.error("Failed to fetch users:", error);
			Alert.alert("Error", "Failed to fetch users");
			if (!loadMore) setUsers([]);
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
			setIsLoadingMore(false);
		}
	};

	useEffect(() => {
		fetchUsers();
	}, []);

	// Search handler
	const handleSearch = () => {
		setCurrentOffset(0);
		setHasMore(true);
		fetchUsers(true);
	};

	// Load more handler
	const handleLoadMore = () => {
		if (!isLoadingMore && hasMore && !isLoading) {
			fetchUsers(false, true);
		}
	};

	// Create User
	const handleCreateUser = () => {
		setModalMode("create");
		setUserName("");
		setUserEmail("");
		setUserPassword("");
		setShowModal(true);
	};

	// Edit User
	const handleEditUser = (user: User) => {
		setModalMode("edit");
		setSelectedUser(user);
		setUserName(user.name);
		setUserEmail(user.email);
		setShowModal(true);
	};

	// Change Password
	const handleChangePassword = (user: User) => {
		setModalMode("password");
		setSelectedUser(user);
		setUserPassword("");
		setShowModal(true);
	};

	// Ban User
	const handleBanUser = (user: User) => {
		setModalMode("ban");
		setSelectedUser(user);
		setBanReason("");
		setBanDuration("7"); // Default 7 days
		setShowModal(true);
	};

	// Unban User
	const handleUnbanUser = async (user: User) => {
		try {
			const { error } = await authClient.admin.unbanUser({
				userId: user.id,
			});

			if (error) {
				Alert.alert("Error", error.message || "Failed to unban user");
				return;
			}

			Alert.alert("Success", "User unbanned successfully");
			fetchUsers();
		} catch (error) {
			console.error("Unban error:", error);
			Alert.alert("Error", "Something went wrong");
		}
	};

	// Delete User
	const handleDeleteUser = (user: User) => {
		Alert.alert(
			"Delete User",
			`Are you sure you want to delete ${user.name}? This action cannot be undone.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							const { error } = await authClient.admin.removeUser({
								userId: user.id,
							});

							if (error) {
								Alert.alert("Error", error.message || "Failed to delete user");
								return;
							}

							Alert.alert("Success", "User deleted successfully");
							fetchUsers();
						} catch (error) {
							console.error("Delete error:", error);
							Alert.alert("Error", "Something went wrong");
						}
					},
				},
			],
		);
	};

	// Submit Modal Form
	const handleSubmit = async () => {
		setIsSubmitting(true);

		try {
			if (modalMode === "create") {
				if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
					Alert.alert("Error", "Please fill in all fields");
					setIsSubmitting(false);
					return;
				}

				const { error } = await authClient.admin.createUser({
					name: userName,
					email: userEmail,
					password: userPassword,
				});

				if (error) {
					Alert.alert("Error", error.message || "Failed to create user");
					setIsSubmitting(false);
					return;
				}

				Alert.alert("Success", "User created successfully");
			} else if (modalMode === "edit" && selectedUser) {
				if (!userName.trim() || !userEmail.trim()) {
					Alert.alert("Error", "Please fill in all fields");
					setIsSubmitting(false);
					return;
				}

				const { error } = await authClient.admin.updateUser({
					userId: selectedUser.id,
					data: {
						name: userName,
						email: userEmail,
					},
				});

				if (error) {
					Alert.alert("Error", error.message || "Failed to update user");
					setIsSubmitting(false);
					return;
				}

				Alert.alert("Success", "User updated successfully");
			} else if (modalMode === "password" && selectedUser) {
				if (!userPassword.trim()) {
					Alert.alert("Error", "Please enter a password");
					setIsSubmitting(false);
					return;
				}

				const { error } = await authClient.admin.setUserPassword({
					userId: selectedUser.id,
					newPassword: userPassword,
				});

				if (error) {
					Alert.alert("Error", error.message || "Failed to change password");
					setIsSubmitting(false);
					return;
				}

				Alert.alert("Success", "Password changed successfully");
			} else if (modalMode === "ban" && selectedUser) {
				if (!banReason.trim()) {
					Alert.alert("Error", "Please provide a ban reason");
					setIsSubmitting(false);
					return;
				}

				const durationInSeconds = banDuration
					? Number.parseInt(banDuration) * 24 * 60 * 60
					: undefined;

				const { error } = await authClient.admin.banUser({
					userId: selectedUser.id,
					banReason: banReason,
					banExpiresIn: durationInSeconds,
				});

				if (error) {
					Alert.alert("Error", error.message || "Failed to ban user");
					setIsSubmitting(false);
					return;
				}

				Alert.alert("Success", "User banned successfully");
			}

			setShowModal(false);
			fetchUsers();
		} catch (error) {
			console.error("Submit error:", error);
			Alert.alert("Error", "Something went wrong");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return <LoadingScreen message="Loading users..." />;
	}

	return (
		<Container>
			<View className="flex-1 p-4">
				{/* Header */}
				<View className="mb-6 flex-row items-center gap-3">
					<Pressable
						onPress={() => router.back()}
						className="h-10 w-10 items-center justify-center rounded-full bg-default-100 active:opacity-70"
						hitSlop={8}
					>
						<Ionicons name="arrow-back" size={20} className="text-foreground" />
					</Pressable>
					<View className="flex-1">
						<Typography variant="title2" className="font-bold text-foreground">
							User Management
						</Typography>
						<Typography variant="caption" className="mt-0.5 text-foreground/60">
							Create and manage system users
						</Typography>
					</View>
				</View>

				{/* Search Bar */}
				<View className="mb-4 flex-row gap-2">
					<View className="flex-1">
						<Input
							placeholder="Search users by name..."
							value={searchQuery}
							onChangeText={setSearchQuery}
							onSubmitEditing={handleSearch}
						/>
					</View>
					<Button variant="secondary" onPress={handleSearch}>
						<Ionicons name="search" size={20} />
					</Button>
					<Button variant="primary" onPress={handleCreateUser}>
						<Ionicons name="person-add" size={20} />
					</Button>
				</View>

				{/* Users List */}
				<ScrollView
					className="flex-1"
					showsVerticalScrollIndicator={false}
					onScroll={({ nativeEvent }) => {
						const { layoutMeasurement, contentOffset, contentSize } =
							nativeEvent;
						const isCloseToBottom =
							layoutMeasurement.height + contentOffset.y >=
							contentSize.height - 100;
						if (isCloseToBottom) {
							handleLoadMore();
						}
					}}
					scrollEventThrottle={400}
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={() => fetchUsers(true)}
						/>
					}
				>
					{users.length === 0 ? (
						<Surface className="mt-4 items-center p-10">
							<Ionicons
								name="people-outline"
								size={48}
								className="text-foreground/30"
							/>
							<Typography
								variant="body"
								className="mt-4 text-center text-foreground/60"
							>
								No users found
							</Typography>
						</Surface>
					) : (
						<View className="gap-3">
							{users.map((user) => (
								<Card key={user.id}>
									<View className="p-4">
										<View className="mb-3 flex-row items-center justify-between">
											<View className="flex-1">
												<Typography
													variant="body"
													className="font-semibold text-foreground"
												>
													{user.name}
												</Typography>
												<Typography
													variant="caption"
													className="mt-1 text-foreground/60"
												>
													{user.email}
												</Typography>
												{user.banned && (
													<View className="mt-2 flex-row items-center gap-2">
														<Chip variant="danger" size="sm">
															Banned
														</Chip>
														{user.banReason && (
															<Typography
																variant="caption"
																className="text-danger"
															>
																{user.banReason}
															</Typography>
														)}
													</View>
												)}
											</View>
										</View>

										{/* Actions */}
										<View className="flex-row flex-wrap gap-2">
											<Button
												size="sm"
												variant="secondary"
												onPress={() => handleEditUser(user)}
											>
												<Ionicons name="create-outline" size={14} />
												<Typography variant="caption" className="ml-1">
													Edit
												</Typography>
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onPress={() => handleChangePassword(user)}
											>
												<Ionicons name="key-outline" size={14} />
												<Typography variant="caption" className="ml-1">
													Password
												</Typography>
											</Button>
											{user.banned ? (
												<Button
													size="sm"
													variant="success"
													onPress={() => handleUnbanUser(user)}
												>
													<Ionicons name="checkmark-circle-outline" size={14} />
													<Typography variant="caption" className="ml-1">
														Unban
													</Typography>
												</Button>
											) : (
												<Button
													size="sm"
													variant="warning"
													onPress={() => handleBanUser(user)}
												>
													<Ionicons name="ban-outline" size={14} />
													<Typography variant="caption" className="ml-1">
														Ban
													</Typography>
												</Button>
											)}
											<Button
												size="sm"
												variant="danger"
												onPress={() => handleDeleteUser(user)}
											>
												<Ionicons name="trash-outline" size={14} />
												<Typography variant="caption" className="ml-1">
													Delete
												</Typography>
											</Button>
										</View>
									</View>
								</Card>
							))}

							{/* Loading More Indicator */}
							{isLoadingMore && (
								<View className="items-center py-4">
									<Typography variant="caption" className="text-foreground/60">
										Loading more users...
									</Typography>
								</View>
							)}

							{/* End of List */}
							{!hasMore && users.length > 0 && (
								<View className="items-center py-4">
									<Typography variant="caption" className="text-foreground/40">
										No more users to load
									</Typography>
								</View>
							)}
						</View>
					)}
				</ScrollView>

				{/* Dialog Modal with Keyboard Avoidance */}
				<DialogModal
					visible={showModal}
					onClose={() => setShowModal(false)}
					title={
						modalMode === "create"
							? "Create User"
							: modalMode === "edit"
								? "Edit User"
								: modalMode === "password"
									? "Change Password"
									: "Ban User"
					}
					subtitle={
						modalMode === "create"
							? "Add a new user to the system"
							: modalMode === "edit"
								? "Update user profile details"
								: modalMode === "password"
									? "Set a new login password"
									: "Restrict user access"
					}
					footer={
						<View className="flex-row justify-end gap-3">
							<Button
								variant="ghost"
								size="sm"
								onPress={() => setShowModal(false)}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								onPress={handleSubmit}
								disabled={isSubmitting}
							>
								{isSubmitting
									? "Saving..."
									: modalMode === "create"
										? "Create User"
										: modalMode === "edit"
											? "Update User"
											: modalMode === "password"
												? "Change Password"
												: "Confirm Ban"}
							</Button>
						</View>
					}
				>
					<View className="gap-4">
						{(modalMode === "create" || modalMode === "edit") && (
							<>
								<TextField>
									<Label>Full Name</Label>
									<Input
										placeholder="Enter full name"
										value={userName}
										onChangeText={setUserName}
									/>
								</TextField>
								<TextField>
									<Label>Email</Label>
									<Input
										placeholder="user@example.com"
										value={userEmail}
										onChangeText={setUserEmail}
										keyboardType="email-address"
										autoCapitalize="none"
									/>
								</TextField>
							</>
						)}

						{modalMode === "create" && (
							<TextField>
								<Label>Password</Label>
								<Input
									placeholder="Enter password"
									value={userPassword}
									onChangeText={setUserPassword}
									secureTextEntry
								/>
								<Description>Minimum 6 characters</Description>
							</TextField>
						)}

						{modalMode === "password" && (
							<TextField>
								<Label>New Password</Label>
								<Input
									placeholder="Enter new password"
									value={userPassword}
									onChangeText={setUserPassword}
									secureTextEntry
								/>
								<Description>Minimum 6 characters</Description>
							</TextField>
						)}

						{modalMode === "ban" && (
							<>
								<TextField>
									<Label>Ban Reason</Label>
									<Input
										placeholder="Reason for ban"
										value={banReason}
										onChangeText={setBanReason}
									/>
								</TextField>
								<TextField>
									<Label>Duration (days)</Label>
									<Input
										placeholder="7"
										value={banDuration}
										onChangeText={setBanDuration}
										keyboardType="numeric"
									/>
									<Description>Leave empty for permanent ban</Description>
								</TextField>
							</>
						)}
					</View>
				</DialogModal>
			</View>
		</Container>
	);
}
