import { Ionicons } from "@expo/vector-icons";
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
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	View,
} from "react-native";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { Container } from "@/components/container";
import { LoadingScreen } from "@/components/loading-screen";
import {
	type OrganizationMember,
	useOrganizationMembers,
} from "@/hooks/use-organization-members";
import { authClient } from "@/lib/auth-client";
import { useOrganizations } from "@/lib/hooks/use-organizations";
import {
	type Organization,
	useOrganizationStore,
} from "@/lib/stores/organization-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemUser {
	id: string;
	name: string;
	email: string;
	createdAt: string;
	banned?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrganizationsScreen() {
	const { organizations, currentOrgId, refetch } = useOrganizations();
	const { setCurrentOrg } = useOrganizationStore();
	const isLoading = useOrganizationStore((state) => state.isLoading);
	const {
		data: members = [],
		refetch: refetchMembers,
		isLoading: isMembersLoading,
	} = useOrganizationMembers();

	// ── Org modal ──────────────────────────────────────────────────────────────
	const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
	const [orgFormMode, setOrgFormMode] = useState<"create" | "edit">("create");
	const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
	const [orgName, setOrgName] = useState("");
	const [orgSlug, setOrgSlug] = useState("");

	// ── Member modal: invite by email OR add existing user ─────────────────────
	const [showMemberModal, setShowMemberModal] = useState(false);
	const [memberModalMode, setMemberModalMode] = useState<
		"invite" | "role" | "add-user"
	>("invite");
	const [selectedMember, setSelectedMember] =
		useState<OrganizationMember | null>(null);
	const [memberEmail, setMemberEmail] = useState("");
	const [memberRole, setMemberRole] = useState("member");

	// ── Add-existing-user state ────────────────────────────────────────────────
	const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
	const [usersLoading, setUsersLoading] = useState(false);
	const [userSearch, setUserSearch] = useState("");
	const [selectedUserId, setSelectedUserId] = useState<string>("");

	// ── Shared ─────────────────────────────────────────────────────────────────
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Force-stop loading after 5 s timeout
	useEffect(() => {
		if (!isLoading) return;
		const t = setTimeout(() => {
			useOrganizationStore.getState().setLoading(false);
		}, 5000);
		return () => clearTimeout(t);
	}, [isLoading]);

	// ── Fetch all system users (for "Add Existing User" modal) ─────────────────
	const fetchSystemUsers = async (search = "") => {
		setUsersLoading(true);
		try {
			const { data, error } = await authClient.admin.listUsers({
				query: {
					limit: 100,
					searchValue: search || undefined,
					searchField: "name",
				},
			});
			if (error) {
				console.error("Failed to list users:", error);
				setSystemUsers([]);
			} else {
				// Filter out users already in the org
				const memberUserIds = new Set(members.map((m) => m.userId));
				const filtered = (data?.users ?? []).filter(
					(u) => !memberUserIds.has(u.id),
				);
				setSystemUsers(filtered as SystemUser[]);
			}
		} catch (e) {
			console.error("fetchSystemUsers error:", e);
			setSystemUsers([]);
		} finally {
			setUsersLoading(false);
		}
	};

	// ── Org handlers ───────────────────────────────────────────────────────────

	const handleCreateOrg = () => {
		setOrgFormMode("create");
		setOrgName("");
		setOrgSlug("");
		setSelectedOrg(null);
		setIsOrgModalOpen(true);
	};

	const handleEditOrg = (org: Organization) => {
		setOrgFormMode("edit");
		setOrgName(org.name);
		setOrgSlug(org.slug);
		setSelectedOrg(org);
		setIsOrgModalOpen(true);
	};

	const handleOrgSubmit = async () => {
		if (!orgName.trim() || !orgSlug.trim()) {
			Alert.alert("Error", "Please fill in all fields");
			return;
		}
		setIsSubmitting(true);
		try {
			if (orgFormMode === "create") {
				const { error } = await authClient.organization.create({
					name: orgName,
					slug: orgSlug,
				});
				if (error) {
					Alert.alert(
						error.status === 403 ? "Permission Denied" : "Error",
						error.message || "Failed to create organization",
					);
					return;
				}
				Alert.alert("Success", "Organization created successfully");
			} else if (selectedOrg) {
				const { error } = await authClient.organization.update({
					organizationId: selectedOrg.id,
					name: orgName,
					slug: orgSlug,
				});
				if (error) {
					Alert.alert(
						"Error",
						error.message || "Failed to update organization",
					);
					return;
				}
				Alert.alert("Success", "Organization updated successfully");
			}
			setIsOrgModalOpen(false);
			refetch();
		} catch (e) {
			Alert.alert(
				"Error",
				e instanceof Error ? e.message : "Something went wrong",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSelectOrg = (orgId: string) => {
		setCurrentOrg(orgId);
		Alert.alert("Success", "Organization selected");
	};

	// ── Member handlers ────────────────────────────────────────────────────────

	const openInviteByEmail = () => {
		setMemberModalMode("invite");
		setMemberEmail("");
		setMemberRole("member");
		setShowMemberModal(true);
	};

	const openAddExistingUser = () => {
		setMemberModalMode("add-user");
		setSelectedUserId("");
		setUserSearch("");
		setMemberRole("member");
		fetchSystemUsers();
		setShowMemberModal(true);
	};

	const handleChangeRole = (member: OrganizationMember) => {
		setMemberModalMode("role");
		setSelectedMember(member);
		setMemberRole(member.role);
		setShowMemberModal(true);
	};

	const handleRemoveMember = (member: OrganizationMember) => {
		Alert.alert(
			"Remove Member",
			`Remove ${member.user.name} from this organization?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: async () => {
						try {
							const { error } = await authClient.organization.removeMember({
								organizationId: currentOrgId!,
								memberIdOrEmail: member.userId,
							});
							if (error) {
								Alert.alert(
									"Error",
									error.message || "Failed to remove member",
								);
								return;
							}
							Alert.alert("Success", "Member removed");
							refetchMembers();
						} catch (e) {
							Alert.alert("Error", "Something went wrong");
						}
					},
				},
			],
		);
	};

	const handleMemberSubmit = async () => {
		setIsSubmitting(true);
		try {
			// ── Invite by email ──────────────────────────────────────────────
			if (memberModalMode === "invite") {
				if (!memberEmail.trim()) {
					Alert.alert("Error", "Please enter an email address");
					return;
				}
				const { error } = await authClient.organization.inviteMember({
					organizationId: currentOrgId!,
					email: memberEmail,
					role: memberRole,
				});
				if (error) {
					Alert.alert("Error", error.message || "Failed to send invite");
					return;
				}
				Alert.alert("Success", "Invitation sent successfully");

				// ── Add existing user directly ────────────────────────────────
			} else if (memberModalMode === "add-user") {
				if (!selectedUserId) {
					Alert.alert("Error", "Please select a user");
					return;
				}
				const user = systemUsers.find((u) => u.id === selectedUserId);
				if (!user) {
					Alert.alert("Error", "Selected user not found");
					return;
				}
				// Use inviteMember with the user's email — Better Auth
				// will add them directly if they already exist in the system.
				const { error } = await authClient.organization.inviteMember({
					organizationId: currentOrgId!,
					email: user.email,
					role: memberRole,
				});
				if (error) {
					Alert.alert("Error", error.message || "Failed to add member");
					return;
				}
				Alert.alert("Success", `${user.name} added to organization`);

				// ── Change role ───────────────────────────────────────────────
			} else if (memberModalMode === "role" && selectedMember) {
				const { error } = await authClient.organization.updateMemberRole({
					organizationId: currentOrgId!,
					memberIdOrEmail: selectedMember.userId,
					role: memberRole,
				});
				if (error) {
					Alert.alert("Error", error.message || "Failed to update role");
					return;
				}
				Alert.alert("Success", "Role updated successfully");
			}

			setShowMemberModal(false);
			refetchMembers();
		} catch (e) {
			Alert.alert(
				"Error",
				e instanceof Error ? e.message : "Something went wrong",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	// ── Filtered users for add-user modal ──────────────────────────────────────
	const filteredSystemUsers = userSearch.trim()
		? systemUsers.filter(
				(u) =>
					u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
					u.email.toLowerCase().includes(userSearch.toLowerCase()),
			)
		: systemUsers;

	// ── Loading ────────────────────────────────────────────────────────────────
	if (isLoading) {
		return <LoadingScreen message="Loading organizations..." />;
	}

	// ── Render ─────────────────────────────────────────────────────────────────
	return (
		<Container className="flex-1">
			{/* ── Header ── */}
			<View className="border-border border-b bg-surface p-4">
				<View className="flex-row items-center justify-between">
					<View className="flex-1">
						<Typography variant="title1" className="text-foreground">
							Organizations
						</Typography>
						<Typography variant="caption" className="mt-1 text-foreground/60">
							Manage organizations & members
						</Typography>
					</View>
					<View className="flex-row gap-2">
						<Button size="sm" variant="secondary" onPress={refetch}>
							<Ionicons name="refresh" size={18} />
						</Button>
						<Button size="sm" variant="primary" onPress={handleCreateOrg}>
							<Ionicons name="add" size={18} />
						</Button>
					</View>
				</View>
			</View>

			{/* ── Scrollable content ── */}
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				{/* ── Organizations list ── */}
				{organizations.length === 0 ? (
					<View className="items-center justify-center py-12">
						<Ionicons
							name="business-outline"
							size={64}
							className="text-foreground/20"
						/>
						<Typography variant="body" className="mt-4 text-foreground/60">
							No organizations yet
						</Typography>
						<Typography
							variant="caption"
							className="mt-2 text-center text-foreground/40"
						>
							Tap + to create one
						</Typography>
					</View>
				) : (
					<View className="gap-3">
						{organizations.map((org) => (
							<Card key={org.id}>
								<View className="p-4">
									<View className="mb-3 flex-row items-start justify-between">
										<View className="flex-1 pr-2">
											<Typography
												variant="title3"
												className="mb-1 text-foreground"
											>
												{org.name}
											</Typography>
											<Typography
												variant="caption"
												className="text-foreground/50"
											>
												@{org.slug}
											</Typography>
										</View>
										{currentOrgId === org.id && (
											<Chip size="sm" variant="primary">
												Current
											</Chip>
										)}
									</View>

									<View className="flex-row gap-2">
										<Button
											size="sm"
											variant={
												currentOrgId === org.id ? "secondary" : "primary"
											}
											onPress={() => handleSelectOrg(org.id)}
											disabled={currentOrgId === org.id}
											className="flex-1"
										>
											{currentOrgId === org.id ? "Selected" : "Select"}
										</Button>
										<Button
											size="sm"
											variant="secondary"
											onPress={() => handleEditOrg(org)}
										>
											<Ionicons name="create-outline" size={16} />
										</Button>
									</View>
								</View>
							</Card>
						))}
					</View>
				)}

				{/* ── Members section ── */}
				{currentOrgId && (
					<View className="mt-8">
						{/* Section header */}
						<View className="mb-4 flex-row items-center justify-between">
							<Typography variant="title2" className="text-foreground">
								Members
							</Typography>
							{/* Two add-member buttons */}
							<View className="flex-row gap-2">
								<Button
									size="sm"
									variant="secondary"
									onPress={openAddExistingUser}
								>
									<Ionicons name="people-outline" size={16} />
								</Button>
								<Button size="sm" variant="primary" onPress={openInviteByEmail}>
									<Ionicons name="mail-outline" size={16} />
								</Button>
							</View>
						</View>

						{/* Legend */}
						<View className="mb-3 flex-row gap-4">
							<View className="flex-row items-center gap-1">
								<Ionicons
									name="people-outline"
									size={14}
									className="text-foreground/50"
								/>
								<Typography variant="caption" className="text-foreground/50">
									Add existing user
								</Typography>
							</View>
							<View className="flex-row items-center gap-1">
								<Ionicons
									name="mail-outline"
									size={14}
									className="text-foreground/50"
								/>
								<Typography variant="caption" className="text-foreground/50">
									Invite by email
								</Typography>
							</View>
						</View>

						{/* Member cards */}
						{isMembersLoading ? (
							<View className="items-center py-8">
								<Typography variant="body" className="text-foreground/60">
									Loading members...
								</Typography>
							</View>
						) : members.length === 0 ? (
							<Surface className="items-center p-8">
								<Ionicons
									name="people-outline"
									size={40}
									className="text-foreground/30"
								/>
								<Typography
									variant="body"
									className="mt-3 text-center text-foreground/60"
								>
									No members yet.{"\n"}Add someone to get started!
								</Typography>
							</Surface>
						) : (
							<View className="gap-3">
								{members.map((member) => (
									<Card key={member.id}>
										<View className="p-4">
											<View className="flex-row items-center justify-between">
												<View className="flex-1 pr-2">
													<View className="mb-1 flex-row items-center gap-2">
														<Typography
															variant="title3"
															className="text-foreground"
														>
															{member.user.name}
														</Typography>
														<Chip
															size="sm"
															variant={
																member.role === "owner"
																	? "primary"
																	: member.role === "admin"
																		? "secondary"
																		: "default"
															}
														>
															{member.role}
														</Chip>
													</View>
													<Typography
														variant="caption"
														className="text-foreground/50"
													>
														{member.user.email}
													</Typography>
												</View>
												<View className="flex-row gap-2">
													<Button
														size="sm"
														variant="secondary"
														onPress={() => handleChangeRole(member)}
													>
														<Ionicons name="shield-outline" size={16} />
													</Button>
													<Button
														size="sm"
														variant="danger"
														onPress={() => handleRemoveMember(member)}
													>
														<Ionicons name="trash-outline" size={16} />
													</Button>
												</View>
											</View>
										</View>
									</Card>
								))}
							</View>
						)}
					</View>
				)}
			</ScrollView>

			{/* ══════════════════════════════════════════════════════════════════
			    Org Create / Edit Modal (Keyboard-avoiding Bottom Sheet)
			══════════════════════════════════════════════════════════════════ */}
			<BottomSheetModal
				visible={isOrgModalOpen}
				onClose={() => setIsOrgModalOpen(false)}
				title={
					orgFormMode === "create" ? "Create Organization" : "Edit Organization"
				}
				subtitle={
					orgFormMode === "create"
						? "Set up a new workspace for your team"
						: "Update organization name and slug"
				}
				footer={
					<View className="flex-row justify-end gap-3">
						<Button
							variant="ghost"
							size="sm"
							onPress={() => setIsOrgModalOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="sm"
							onPress={handleOrgSubmit}
							disabled={isSubmitting}
						>
							{isSubmitting
								? "Saving..."
								: orgFormMode === "create"
									? "Create Organization"
									: "Update Organization"}
						</Button>
					</View>
				}
			>
				<View className="gap-4">
					<TextField>
						<Label>Organization Name</Label>
						<Input
							placeholder="Enter organization name"
							value={orgName}
							onChangeText={setOrgName}
						/>
					</TextField>

					<TextField>
						<Label>Slug</Label>
						<Input
							placeholder="organization-slug"
							value={orgSlug}
							onChangeText={(t) =>
								setOrgSlug(t.toLowerCase().replace(/\s+/g, "-"))
							}
						/>
						<Description>Used in URLs, must be unique</Description>
					</TextField>
				</View>
			</BottomSheetModal>

			{/* ══════════════════════════════════════════════════════════════════
			    Member Modal — Invite / Add Existing / Change Role (Keyboard-avoiding)
			══════════════════════════════════════════════════════════════════ */}
			<BottomSheetModal
				visible={showMemberModal}
				onClose={() => setShowMemberModal(false)}
				title={
					memberModalMode === "invite"
						? "Invite by Email"
						: memberModalMode === "add-user"
							? "Add Existing User"
							: "Change Member Role"
				}
				subtitle={
					memberModalMode === "invite"
						? "Send an email invitation to join this organization"
						: memberModalMode === "add-user"
							? "Pick a registered user and assign them a role directly"
							: `Update role for ${selectedMember?.user.name}`
				}
				footer={
					<View className="flex-row justify-end gap-3">
						<Button
							variant="ghost"
							size="sm"
							onPress={() => setShowMemberModal(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="sm"
							onPress={handleMemberSubmit}
							disabled={
								isSubmitting ||
								(memberModalMode === "add-user" && !selectedUserId)
							}
						>
							{isSubmitting
								? "Saving..."
								: memberModalMode === "invite"
									? "Send Invite"
									: memberModalMode === "add-user"
										? "Add Member"
										: "Update Role"}
						</Button>
					</View>
				}
			>
				<View className="gap-4">
					{/* ── Invite by email ── */}
					{memberModalMode === "invite" && (
						<TextField>
							<Label>Email Address</Label>
							<Input
								placeholder="member@example.com"
								value={memberEmail}
								onChangeText={setMemberEmail}
								keyboardType="email-address"
								autoCapitalize="none"
							/>
						</TextField>
					)}

					{/* ── Add existing user — user picker ── */}
					{memberModalMode === "add-user" && (
						<View className="gap-3">
							{/* Search */}
							<TextField>
								<Label>Search Users</Label>
								<Input
									placeholder="Search by name or email..."
									value={userSearch}
									onChangeText={setUserSearch}
								/>
							</TextField>

							{/* User list */}
							{usersLoading ? (
								<View className="items-center py-4">
									<Typography variant="caption" className="text-foreground/60">
										Loading users...
									</Typography>
								</View>
							) : filteredSystemUsers.length === 0 ? (
								<Surface className="items-center p-4">
									<Typography variant="caption" className="text-foreground/60">
										{systemUsers.length === 0
											? "All registered users are already members"
											: "No users match your search"}
									</Typography>
								</Surface>
							) : (
								<ScrollView
									style={{ maxHeight: 200 }}
									nestedScrollEnabled={true}
									showsVerticalScrollIndicator={false}
								>
									<View className="gap-2">
										{filteredSystemUsers.map((u) => (
											<Pressable
												key={u.id}
												onPress={() => setSelectedUserId(u.id)}
											>
												<View
													className={`rounded-xl border p-3 ${
														selectedUserId === u.id
															? "border-primary bg-primary/10"
															: "border-border bg-surface"
													}`}
												>
													<View className="flex-row items-center justify-between">
														<View className="flex-1">
															<Typography
																variant="body"
																className="font-semibold text-foreground"
															>
																{u.name}
															</Typography>
															<Typography
																variant="caption"
																className="text-foreground/50"
															>
																{u.email}
															</Typography>
														</View>
														{selectedUserId === u.id && (
															<Ionicons
																name="checkmark-circle"
																size={20}
																className="text-primary"
															/>
														)}
													</View>
												</View>
											</Pressable>
										))}
									</View>
								</ScrollView>
							)}
						</View>
					)}

					{/* ── Role selector (shown for invite, add-user, and role-change) ── */}
					{(memberModalMode === "invite" ||
						memberModalMode === "add-user" ||
						memberModalMode === "role") && (
						<TextField>
							<Label>Role</Label>
							<Select
								value={memberRole}
								onValueChange={setMemberRole}
								placeholder="Select role"
							>
								<Select.Item
									value="member"
									label="Member — Can view and manage assigned tasks"
								/>
								<Select.Item
									value="admin"
									label="Admin — Can manage members and settings"
								/>
								<Select.Item
									value="owner"
									label="Owner — Full control over organization"
								/>
							</Select>
						</TextField>
					)}
				</View>
			</BottomSheetModal>
		</Container>
	);
}
