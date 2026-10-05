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
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";

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

export default function OrganizationsScreen() {
	const { organizations, currentOrgId, refetch } = useOrganizations();
	const { setCurrentOrg } = useOrganizationStore();
	const isLoading = useOrganizationStore((state) => state.isLoading);
	const {
		data: members = [],
		refetch: refetchMembers,
		isLoading: isMembersLoading,
	} = useOrganizationMembers();

	// Modal states
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [formMode, setFormMode] = useState<"create" | "edit">("create");
	const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

	// Member management modal
	const [showMemberModal, setShowMemberModal] = useState<boolean>(false);
	const [memberModalMode, setMemberModalMode] = useState<"invite" | "role">(
		"invite",
	);
	const [selectedMember, setSelectedMember] =
		useState<OrganizationMember | null>(null);

	// Form state
	const [orgName, setOrgName] = useState("");
	const [orgSlug, setOrgSlug] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Member form state
	const [memberEmail, setMemberEmail] = useState("");
	const [memberRole, setMemberRole] = useState("member");

	// Force stop loading after timeout
	useEffect(() => {
		if (isLoading) {
			const timeout = setTimeout(() => {
				console.log("⚠️ Loading timeout - forcing stop");
				useOrganizationStore.getState().setLoading(false);
			}, 5000); // 5 second timeout

			return () => clearTimeout(timeout);
		}
	}, [isLoading]);

	const handleCreate = () => {
		setFormMode("create");
		setOrgName("");
		setOrgSlug("");
		setSelectedOrg(null);
		setIsOpen(true);
	};

	const handleEdit = (org: Organization) => {
		setFormMode("edit");
		setOrgName(org.name);
		setOrgSlug(org.slug);
		setSelectedOrg(org);
		setIsOpen(true);
	};

	const handleSubmit = async () => {
		if (!orgName.trim() || !orgSlug.trim()) {
			Alert.alert("Error", "Please fill in all fields");
			return;
		}

		setIsSubmitting(true);
		try {
			if (formMode === "create") {
				// Use Better Auth organization plugin method
				const { data, error } = await authClient.organization.create({
					name: orgName,
					slug: orgSlug,
				});

				if (error) {
					console.error("Create organization error:", error);
					// Check if it's a permission error
					if (error.status === 403 || error.message?.includes("permission")) {
						Alert.alert(
							"Permission Denied",
							"Only administrators can create organizations. Please contact your admin.",
						);
					} else {
						Alert.alert(
							"Error",
							error.message || "Failed to create organization",
						);
					}
					return;
				}

				Alert.alert("Success", "Organization created successfully");
			} else if (selectedOrg) {
				// Use Better Auth organization plugin method
				const { data, error } = await authClient.organization.update({
					organizationId: selectedOrg.id,
					name: orgName,
					slug: orgSlug,
				});

				if (error) {
					console.error("Update organization error:", error);
					Alert.alert(
						"Error",
						error.message || "Failed to update organization",
					);
					return;
				}

				Alert.alert("Success", "Organization updated successfully");
			}

			setIsOpen(false);
			// Refresh organizations list
			refetch();
		} catch (error) {
			console.error("Organization submit error:", error);
			Alert.alert(
				"Error",
				error instanceof Error ? error.message : "Something went wrong",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSelectOrg = (orgId: string) => {
		setCurrentOrg(orgId);
		Alert.alert("Success", "Organization selected");
	};

	const handleInviteMember = () => {
		setMemberModalMode("invite");
		setMemberEmail("");
		setMemberRole("member");
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
			`Are you sure you want to remove ${member.user.name} from this organization?`,
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

							Alert.alert("Success", "Member removed successfully");
							refetchMembers();
						} catch (error) {
							console.error("Remove member error:", error);
							Alert.alert(
								"Error",
								error instanceof Error ? error.message : "Something went wrong",
							);
						}
					},
				},
			],
		);
	};

	const handleMemberSubmit = async () => {
		if (memberModalMode === "invite") {
			if (!memberEmail.trim()) {
				Alert.alert("Error", "Please enter an email address");
				return;
			}

			setIsSubmitting(true);
			try {
				const { error } = await authClient.organization.inviteMember({
					organizationId: currentOrgId!,
					email: memberEmail,
					role: memberRole,
				});

				if (error) {
					Alert.alert("Error", error.message || "Failed to invite member");
					return;
				}

				Alert.alert("Success", "Member invited successfully");
				setShowMemberModal(false);
				refetchMembers();
			} catch (error) {
				console.error("Invite member error:", error);
				Alert.alert(
					"Error",
					error instanceof Error ? error.message : "Something went wrong",
				);
			} finally {
				setIsSubmitting(false);
			}
		} else if (memberModalMode === "role" && selectedMember) {
			setIsSubmitting(true);
			try {
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
				setShowMemberModal(false);
				refetchMembers();
			} catch (error) {
				console.error("Update role error:", error);
				Alert.alert(
					"Error",
					error instanceof Error ? error.message : "Something went wrong",
				);
			} finally {
				setIsSubmitting(false);
			}
		}
	};

	if (isLoading) {
		return <LoadingScreen message="Loading organizations..." />;
	}

	return (
		<Container className="flex-1">
			{/* Header */}
			<View className="border-border border-b bg-surface p-4">
				<View className="mb-2 flex-row items-center justify-between">
					<View className="flex-1">
						<Typography variant="title1" className="text-foreground">
							Organizations
						</Typography>
						<Typography variant="caption" className="mt-1 text-foreground/60">
							Manage your organizations and members
						</Typography>
					</View>
					<View className="flex-row gap-2">
						<Button size="sm" variant="secondary" onPress={refetch}>
							<Ionicons name="refresh" size={18} />
						</Button>
						<Button size="sm" variant="primary" onPress={handleCreate}>
							<Ionicons name="add" size={18} />
						</Button>
					</View>
				</View>
			</View>

			{/* Content */}
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Organizations List */}
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
							Create one to get started!
						</Typography>
					</View>
				) : (
					<View className="gap-3">
						{organizations.map((org) => (
							<Card key={org.id} className="mb-1">
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
											onPress={() => handleEdit(org)}
										>
											<Ionicons name="create-outline" size={16} />
										</Button>
									</View>
								</View>
							</Card>
						))}
					</View>
				)}

				{/* Members Section - Show only for current org */}
				{currentOrgId && (
					<View className="mt-6">
						<View className="mb-4 flex-row items-center justify-between">
							<Typography variant="title2" className="text-foreground">
								Members
							</Typography>
							<Button size="sm" variant="primary" onPress={handleInviteMember}>
								<Ionicons name="person-add" size={16} />
							</Button>
						</View>

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
									No members yet.{"\n"}Invite someone to get started!
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
																member.role === "admin"
																	? "primary"
																	: member.role === "owner"
																		? "primary"
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

			{/* Create/Edit Modal */}
			<Modal
				visible={isOpen}
				animationType="slide"
				transparent={true}
				onRequestClose={() => setIsOpen(false)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<Surface className="rounded-t-3xl p-6 pb-8">
						{/* Header */}
						<View className="mb-6 flex-row items-center justify-between">
							<Typography variant="title2" className="text-foreground">
								{formMode === "create" ? "Create" : "Edit"} Organization
							</Typography>
							<Pressable onPress={() => setIsOpen(false)}>
								<Ionicons
									name="close"
									size={24}
									className="text-foreground/60"
								/>
							</Pressable>
						</View>

						{/* Description */}
						<Typography variant="body" className="mb-6 text-foreground/60">
							{formMode === "create"
								? "Create a new organization to manage your inventory"
								: "Update organization details"}
						</Typography>

						{/* Form Fields */}
						<View className="mb-6 gap-4">
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
									onChangeText={(text) =>
										setOrgSlug(text.toLowerCase().replace(/\s+/g, "-"))
									}
								/>
								<Description>Used in URLs and must be unique</Description>
							</TextField>
						</View>

						{/* Actions */}
						<View className="flex-row justify-end gap-3">
							<Button
								variant="ghost"
								size="sm"
								onPress={() => setIsOpen(false)}
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
									: formMode === "create"
										? "Create"
										: "Update"}
							</Button>
						</View>
					</Surface>
				</View>
			</Modal>

			{/* Member Management Modal */}
			<Modal
				visible={showMemberModal}
				animationType="slide"
				transparent={true}
				onRequestClose={() => setShowMemberModal(false)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<Surface className="rounded-t-3xl p-6 pb-8">
						{/* Header */}
						<View className="mb-6 flex-row items-center justify-between">
							<Typography variant="title2" className="text-foreground">
								{memberModalMode === "invite" ? "Invite Member" : "Change Role"}
							</Typography>
							<Pressable onPress={() => setShowMemberModal(false)}>
								<Ionicons
									name="close"
									size={24}
									className="text-foreground/60"
								/>
							</Pressable>
						</View>

						{/* Description */}
						<Typography variant="body" className="mb-6 text-foreground/60">
							{memberModalMode === "invite"
								? "Send an invitation to join this organization"
								: `Update role for ${selectedMember?.user.name}`}
						</Typography>

						{/* Form Fields */}
						<View className="mb-6 gap-4">
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

							<TextField>
								<Label>Role</Label>
								<Select
									value={memberRole}
									onValueChange={setMemberRole}
									placeholder="Select role"
								>
									<Select.Item value="member" label="Member" />
									<Select.Item value="admin" label="Admin" />
									<Select.Item value="owner" label="Owner" />
								</Select>
								<Description>
									{memberRole === "member"
										? "Can view and manage assigned tasks"
										: memberRole === "admin"
											? "Can manage members and settings"
											: "Full control over organization"}
								</Description>
							</TextField>
						</View>

						{/* Actions */}
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
								disabled={isSubmitting}
							>
								{isSubmitting
									? "Saving..."
									: memberModalMode === "invite"
										? "Send Invite"
										: "Update Role"}
							</Button>
						</View>
					</Surface>
				</View>
			</Modal>
		</Container>
	);
}
