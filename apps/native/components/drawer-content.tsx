import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Surface, useThemeColor } from "heroui-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { useOrganizations } from "@/lib/hooks/use-organizations";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export function CustomDrawerContent(props: any) {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");

	// Fetch organizations when drawer mounts
	const { organizations: orgsFromHook } = useOrganizations();

	// Get store values with individual selectors for better reactivity
	const organizations = useOrganizationStore((state) => state.organizations);
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const setCurrentOrg = useOrganizationStore((state) => state.setCurrentOrg);

	// Calculate current org from organizations and currentOrgId
	const currentOrg =
		organizations.find((org) => org.id === currentOrgId) || null;

	const [isOrgListExpanded, setIsOrgListExpanded] = useState(false);

	// Debug logging
	useEffect(() => {
		console.log("=== DRAWER DEBUG ===");
		console.log("Organizations count:", organizations.length);
		console.log("Organizations:", organizations);
		console.log("Current Org ID:", currentOrgId);
		console.log("Current Org:", currentOrg);
		console.log("Is Expanded:", isOrgListExpanded);
		console.log("===================");
	}, [organizations, currentOrgId, currentOrg, isOrgListExpanded]);

	const handleOrgSelect = (orgId: string) => {
		console.log("Selecting org:", orgId);
		setCurrentOrg(orgId);
		setIsOrgListExpanded(false);

		// Get the selected org name for alert
		const selectedOrg = organizations.find((o) => o.id === orgId);
		Alert.alert("Success", `Selected: ${selectedOrg?.name || "Organization"}`);
	};

	const handleManageOrgs = () => {
		router.push("/(drawer)/(tabs)/organizations");
		props.navigation.closeDrawer();
	};

	const navigateTo = (route: string) => {
		router.push(route as any);
		props.navigation.closeDrawer();
	};

	return (
		<ScrollView
			style={{ backgroundColor: themeColorBackground, flex: 1 }}
			contentContainerStyle={{ flexGrow: 1 }}
		>
			{/* Organization Selector */}
			<View className="mb-2 border-default-200 border-b px-4 py-6">
				<Text
					className="mb-3 font-medium text-xs opacity-60"
					style={{ color: themeColorForeground }}
				>
					CURRENT ORGANIZATION
				</Text>

				{/* Current Org Display - Click to Toggle List */}
				<Pressable onPress={() => setIsOrgListExpanded(!isOrgListExpanded)}>
					<Surface
						variant="secondary"
						className="flex-row items-center justify-between rounded-lg p-3"
					>
						<View className="flex-1 flex-row items-center">
							<View className="mr-3 size-10 items-center justify-center rounded-full bg-primary/10">
								<Ionicons
									name="business"
									size={20}
									color={themeColorForeground}
								/>
							</View>
							<View className="flex-1">
								{currentOrg ? (
									<>
										<Text
											className="font-semibold text-base"
											style={{ color: themeColorForeground }}
											numberOfLines={1}
										>
											{currentOrg.name}
										</Text>
										<Text
											className="mt-0.5 text-sm opacity-60"
											style={{ color: themeColorForeground }}
										>
											@{currentOrg.slug}
										</Text>
									</>
								) : (
									<Text
										className="text-sm opacity-60"
										style={{ color: themeColorForeground }}
									>
										No organization selected
									</Text>
								)}
							</View>
						</View>
						<Ionicons
							name={isOrgListExpanded ? "chevron-up" : "chevron-down"}
							size={20}
							color={themeColorForeground}
							style={{ opacity: 0.6 }}
						/>
					</Surface>
				</Pressable>

				{/* Expanded Organization List */}
				{isOrgListExpanded && organizations.length > 0 && (
					<View className="mt-3 gap-2">
						{organizations.map((org) => (
							<Pressable
								key={org.id}
								onPress={() => handleOrgSelect(org.id)}
								className={`flex-row items-center rounded-lg p-3 ${
									currentOrgId === org.id ? "bg-primary/10" : "bg-default-100"
								}`}
							>
								<View className="flex-1">
									<Text
										className="font-medium text-sm"
										style={{ color: themeColorForeground }}
									>
										{org.name}
									</Text>
									<Text
										className="text-xs opacity-60"
										style={{ color: themeColorForeground }}
									>
										@{org.slug}
									</Text>
								</View>
								{currentOrgId === org.id && (
									<Ionicons
										name="checkmark-circle"
										size={20}
										color={themeColorForeground}
									/>
								)}
							</Pressable>
						))}
					</View>
				)}

				{/* Manage Organizations Link */}
				<Pressable onPress={handleManageOrgs} className="mt-3">
					<Text
						className="font-medium text-primary text-sm"
						style={{ color: themeColorForeground, opacity: 0.7 }}
					>
						+ Manage Organizations
					</Text>
				</Pressable>
			</View>

			{/* Navigation Items */}
			<View className="flex-1 py-2">
				{/* Tabs */}
				<Pressable
					onPress={() => navigateTo("/(drawer)/(tabs)")}
					className="flex-row items-center px-4 py-3"
				>
					<MaterialIcons
						name="border-bottom"
						size={24}
						color={themeColorForeground}
						style={{ marginRight: 32 }}
					/>
					<Text className="text-base" style={{ color: themeColorForeground }}>
						Tabs
					</Text>
				</Pressable>

				{/* Profile */}
				<Pressable
					onPress={() => navigateTo("/settings/profile")}
					className="flex-row items-center px-4 py-3"
				>
					<Ionicons
						name="person-outline"
						size={24}
						color={themeColorForeground}
						style={{ marginRight: 32 }}
					/>
					<Text className="text-base" style={{ color: themeColorForeground }}>
						Profile
					</Text>
				</Pressable>

				{/* Second */}
				<Pressable
					onPress={() => navigateTo("/(drawer)/second")}
					className="flex-row items-center px-4 py-3"
				>
					<Ionicons
						name="home-outline"
						size={24}
						color={themeColorForeground}
						style={{ marginRight: 32 }}
					/>
					<Text className="text-base" style={{ color: themeColorForeground }}>
						Second
					</Text>
				</Pressable>
			</View>
		</ScrollView>
	);
}
