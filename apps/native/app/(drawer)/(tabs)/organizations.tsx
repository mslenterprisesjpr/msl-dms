import { Ionicons } from "@expo/vector-icons";
import {
	Button,
	Card,
	Description,
	Input,
	Label,
	Surface,
	TextField,
	Typography,
} from "heroui-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingScreen } from "@/components/loading-screen";
import { authClient } from "@/lib/auth-client";
import { useOrganizations } from "@/lib/hooks/use-organizations";
import {
	type Organization,
	useOrganizationStore,
} from "@/lib/stores/organization-store";

export default function OrganizationsScreen() {
	const { organizations, currentOrgId, refetch } = useOrganizations();
	const { setCurrentOrg, isLoading } = useOrganizationStore();
	const [isOpen, setIsOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "edit">("create");
	const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

	// Form state
	const [orgName, setOrgName] = useState("");
	const [orgSlug, setOrgSlug] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

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
				console.log("Creating organization:", { name: orgName, slug: orgSlug });

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

				console.log("Organization created:", data);
				Alert.alert("Success", "Organization created successfully");
			} else if (selectedOrg) {
				// Use Better Auth organization plugin method
				console.log("Updating organization:", {
					id: selectedOrg.id,
					name: orgName,
					slug: orgSlug,
				});

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

				console.log("Organization updated:", data);
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

	if (isLoading) {
		return <LoadingScreen message="Loading organizations..." />;
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-1 p-4">
				{/* Header */}
				<View className="mb-6">
					<Typography variant="title1" className="text-foreground">
						Organizations
					</Typography>
					<Typography variant="body" className="mt-1 text-foreground/60">
						Manage your organizations
					</Typography>
				</View>

				{/* Create Button */}
				<Button onPress={handleCreate} variant="primary" className="mb-4">
					<Ionicons name="add" size={20} color="white" />
					<Typography variant="button" className="ml-2 text-primary-foreground">
						Create Organization
					</Typography>
				</Button>

				{/* Organizations List */}
				<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
					{organizations.length === 0 ? (
						<Surface className="mt-4 items-center p-10">
							<Ionicons name="business-outline" size={48} color="#888" />
							<Typography
								variant="body"
								className="mt-4 text-center text-foreground/60"
							>
								No organizations yet.{"\n"}Create one to get started!
							</Typography>
						</Surface>
					) : (
						<View className="gap-4">
							{organizations.map((org) => (
								<Card key={org.id} className="w-full">
									<Card.Body>
										<View className="mb-3 flex-row items-center justify-between">
											<View className="flex-1">
												<Card.Title className="text-lg">{org.name}</Card.Title>
												<Card.Description className="text-sm">
													@{org.slug}
												</Card.Description>
											</View>
											{currentOrgId === org.id && (
												<Surface
													variant="success"
													className="rounded-full px-3 py-1"
												>
													<Typography
														variant="caption"
														className="font-medium text-success"
													>
														Current
													</Typography>
												</Surface>
											)}
										</View>
										<View className="mt-2 flex-row gap-2">
											<Button
												size="sm"
												variant="secondary"
												onPress={() => handleSelectOrg(org.id)}
												disabled={currentOrgId === org.id}
												className="flex-1"
											>
												<Typography variant="caption">Select</Typography>
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onPress={() => handleEdit(org)}
											>
												<Ionicons name="create-outline" size={16} />
												<Typography variant="caption" className="ml-1">
													Edit
												</Typography>
											</Button>
										</View>
									</Card.Body>
								</Card>
							))}
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
								<Text className="font-bold text-foreground text-xl">
									{formMode === "create" ? "Create" : "Edit"} Organization
								</Text>
								<Pressable onPress={() => setIsOpen(false)}>
									<Ionicons name="close" size={24} color="#888" />
								</Pressable>
							</View>

							{/* Description */}
							<Text className="mb-6 text-default-500 text-sm">
								{formMode === "create"
									? "Create a new organization to manage your inventory"
									: "Update organization details"}
							</Text>

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
									<Text>Cancel</Text>
								</Button>
								<Button
									variant="primary"
									size="sm"
									onPress={handleSubmit}
									disabled={isSubmitting}
								>
									<Text className="text-primary-foreground">
										{isSubmitting
											? "Saving..."
											: formMode === "create"
												? "Create"
												: "Update"}
									</Text>
								</Button>
							</View>
						</Surface>
					</View>
				</Modal>
			</View>
		</SafeAreaView>
	);
}
