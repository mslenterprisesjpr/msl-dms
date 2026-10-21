import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Surface, useThemeColor } from "heroui-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MslLogo } from "@/components/msl-logo";
import { useOrganizations } from "@/lib/hooks/use-organizations";
import { useSession } from "@/lib/hooks/use-session";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export function CustomDrawerContent(props: any) {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const themeColorAccent = useThemeColor("accent");
	const { user } = useSession();
	const isSystemAdmin = user?.role === "admin";
	const appVersion = Constants.expoConfig?.version || "1.0.0";

	// Fetch organizations when drawer mounts
	const { organizations: orgsFromHook } = useOrganizations();

	// Get store values with individual selectors for better reactivity
	const organizations = useOrganizationStore((state) => state.organizations);
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);
	const setCurrentOrg = useOrganizationStore((state) => state.setCurrentOrg);

	// Calculate current org from organizations and currentOrgId (with null safety)
	const currentOrg =
		organizations.find((org) => org?.id === currentOrgId) || null;

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

		// Get the selected org name for alert (with null safety)
		const selectedOrg = organizations.find((o) => o?.id === orgId);
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
			{/* Drawer Top Official Branding */}
			<View className="flex-row items-center border-default-200 border-b px-4 pt-5 pb-3">
				<MslLogo size="sm" dimension={42} />
				<View className="ml-3">
					<Text
						className="font-extrabold text-base tracking-wide"
						style={{ color: themeColorForeground }}
					>
						MSL ENTERPRISES
					</Text>
					<Text className="font-medium text-[11px] text-slate-500">
						Distribution Management
					</Text>
				</View>
			</View>

			{/* Organization Selector */}
			<View className="mb-2 border-default-200 border-b px-4 py-5">
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
				{/* OPERATIONS SECTION */}
				<Text
					className="px-4 pt-2 pb-1 font-bold text-[10px] uppercase tracking-wider opacity-50"
					style={{ color: themeColorForeground }}
				>
					Distribution Operations
				</Text>

				{/* Tabs Hub */}
				<Pressable
					onPress={() => navigateTo("/(drawer)/(tabs)")}
					className="flex-row items-center px-4 py-3 active:bg-default-100"
				>
					<MaterialIcons
						name="storefront"
						size={22}
						color={themeColorForeground}
						style={{ marginRight: 20 }}
					/>
					<Text
						className="font-medium text-base"
						style={{ color: themeColorForeground }}
					>
						Agency Dashboard & Tabs
					</Text>
				</Pressable>

				{/* SYSTEM SUPER ADMIN SECTION (Role Gated) */}
				{isSystemAdmin && (
					<View className="mt-4 border-default-200 border-t pt-3">
						<View className="flex-row items-center justify-between px-4 pb-1">
							<Text className="font-bold text-[10px] text-accent uppercase tracking-wider">
								🛡️ System Super Admin
							</Text>
							<View className="rounded-full bg-accent/15 px-2 py-0.2">
								<Text className="font-bold text-[9px] text-accent uppercase">
									CONSOLE
								</Text>
							</View>
						</View>

						{/* Platform Overview */}
						<Pressable
							onPress={() => navigateTo("/(drawer)/system-admin")}
							className="flex-row items-center px-4 py-3 active:bg-default-100"
						>
							<Ionicons
								name="stats-chart"
								size={20}
								color={themeColorAccent}
								style={{ marginRight: 20 }}
							/>
							<View className="flex-1">
								<Text
									className="font-semibold text-base"
									style={{ color: themeColorForeground }}
								>
									Platform Overview
								</Text>
								<Text
									className="text-xs opacity-60"
									style={{ color: themeColorForeground }}
								>
									Global telemetry & stats
								</Text>
							</View>
						</Pressable>

						{/* Manage Organizations */}
						<Pressable
							onPress={() => navigateTo("/(drawer)/(tabs)/organizations")}
							className="flex-row items-center px-4 py-3 active:bg-default-100"
						>
							<Ionicons
								name="business"
								size={20}
								color={themeColorAccent}
								style={{ marginRight: 20 }}
							/>
							<View className="flex-1">
								<Text
									className="font-medium text-base"
									style={{ color: themeColorForeground }}
								>
									Organizations & Agencies
								</Text>
								<Text
									className="text-xs opacity-60"
									style={{ color: themeColorForeground }}
								>
									Tenants, invites & members
								</Text>
							</View>
						</Pressable>

						{/* User Management */}
						<Pressable
							onPress={() => navigateTo("/settings/users")}
							className="flex-row items-center px-4 py-3 active:bg-default-100"
						>
							<Ionicons
								name="people"
								size={20}
								color={themeColorAccent}
								style={{ marginRight: 20 }}
							/>
							<View className="flex-1">
								<Text
									className="font-medium text-base"
									style={{ color: themeColorForeground }}
								>
									Global Users Directory
								</Text>
								<Text
									className="text-xs opacity-60"
									style={{ color: themeColorForeground }}
								>
									Ban, roles & credentials
								</Text>
							</View>
						</Pressable>
					</View>
				)}

				{/* ACCOUNT & APP SETTINGS SECTION */}
				<View className="mt-4 border-default-200 border-t pt-3">
					<Text
						className="px-4 pb-1 font-bold text-[10px] uppercase tracking-wider opacity-50"
						style={{ color: themeColorForeground }}
					>
						Account & App
					</Text>

					{/* Profile */}
					<Pressable
						onPress={() => navigateTo("/settings/profile")}
						className="flex-row items-center px-4 py-3 active:bg-default-100"
					>
						<Ionicons
							name="person-outline"
							size={20}
							color={themeColorForeground}
							style={{ marginRight: 20 }}
						/>
						<Text
							className="font-medium text-base"
							style={{ color: themeColorForeground }}
						>
							My Profile
						</Text>
					</Pressable>

					{/* Settings */}
					<Pressable
						onPress={() => navigateTo("/(drawer)/(tabs)/settings")}
						className="flex-row items-center px-4 py-3 active:bg-default-100"
					>
						<Ionicons
							name="settings-outline"
							size={20}
							color={themeColorForeground}
							style={{ marginRight: 20 }}
						/>
						<Text
							className="font-medium text-base"
							style={{ color: themeColorForeground }}
						>
							Settings & Preferences
						</Text>
					</Pressable>

					{/* POS Thermal Printer */}
					<Pressable
						onPress={() => navigateTo("/(drawer)/printer")}
						className="flex-row items-center px-4 py-3 active:bg-default-100"
					>
						<Ionicons
							name="print-outline"
							size={20}
							color={themeColorForeground}
							style={{ marginRight: 20 }}
						/>
						<View className="flex-1">
							<Text
								className="font-medium text-base"
								style={{ color: themeColorForeground }}
							>
								POS Thermal Printer
							</Text>
							<Text
								className="text-xs opacity-60"
								style={{ color: themeColorForeground }}
							>
								Bluetooth 58mm/80mm setup
							</Text>
						</View>
					</Pressable>
				</View>

				{/* APP FOOTER / VERSION INFO */}
				<View className="mt-6 items-center border-default-200 border-t px-4 pt-4 pb-8">
					<Text
						className="font-bold text-xs tracking-wider"
						style={{ color: themeColorForeground }}
					>
						MSL
					</Text>
					<Text
						className="mt-0.5 font-medium text-[11px] opacity-50"
						style={{ color: themeColorForeground }}
					>
						Version {appVersion}
					</Text>
				</View>
			</View>
		</ScrollView>
	);
}
