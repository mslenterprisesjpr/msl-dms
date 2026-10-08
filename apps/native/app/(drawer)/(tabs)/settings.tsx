import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Card, Typography } from "heroui-native";
import { Pressable, ScrollView, View } from "react-native";

import { Container } from "@/components/container";
import { useSession } from "@/lib/hooks/use-session";

export default function SettingsScreen() {
	const { session } = useSession();

	// Check if user is admin
	const isAdmin = session?.user?.role === "admin";

	const settingsOptions = [
		{
			icon: "business-outline" as const,
			title: "Organizations",
			description: "Manage your organizations and members",
			route: "/organizations",
			color: "#3b82f6",
		},
		{
			icon: "people-outline" as const,
			title: "User Management",
			description: "Create and manage system users",
			route: "/settings/users",
			color: "#8b5cf6",
			adminOnly: true,
		},
		{
			icon: "person-outline" as const,
			title: "Profile",
			description: "Update your personal information",
			route: "/settings/profile",
			color: "#10b981",
		},
		{
			icon: "notifications-outline" as const,
			title: "Notifications",
			description: "Manage notification preferences",
			route: "/settings/notifications",
			color: "#f59e0b",
		},
		{
			icon: "lock-closed-outline" as const,
			title: "Security",
			description: "Password and security settings",
			route: "/settings/security",
			color: "#ef4444",
		},
		{
			icon: "information-circle-outline" as const,
			title: "About",
			description: "App version and information",
			route: "/settings/about",
			color: "#6b7280",
		},
	];

	const visibleOptions = settingsOptions.filter(
		(option) => !option.adminOnly || isAdmin,
	);

	return (
		<Container>
			<View className="flex-1 p-4">
				{/* Header */}
				<View className="mb-6">
					<Typography variant="title1" className="text-foreground">
						Settings
					</Typography>
					<Typography variant="body" className="mt-1 text-foreground/60">
						Manage your app preferences and account
					</Typography>
				</View>

				{/* Settings Options */}
				<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
					<View className="gap-3">
						{visibleOptions.map((option) => (
							<Pressable
								key={option.route}
								onPress={() => router.push(option.route as any)}
							>
								<Card className="w-full">
									<View className="flex-row items-center p-4">
										<View
											className="mr-4 h-12 w-12 items-center justify-center rounded-full"
											style={{ backgroundColor: `${option.color}15` }}
										>
											<Ionicons
												name={option.icon}
												size={24}
												color={option.color}
											/>
										</View>
										<View className="flex-1">
											<Typography
												variant="body"
												className="font-semibold text-foreground"
											>
												{option.title}
											</Typography>
											<Typography
												variant="caption"
												className="mt-1 text-foreground/60"
											>
												{option.description}
											</Typography>
										</View>
										<Ionicons
											name="chevron-forward"
											size={20}
											className="text-foreground/40"
										/>
									</View>
								</Card>
							</Pressable>
						))}
					</View>

					{/* User Info Section */}
					<Pressable
						className="mt-8 mb-4 active:opacity-85"
						onPress={() => router.push("/settings/profile" as any)}
					>
						<Card>
							<View className="p-4">
								<View className="mb-1 flex-row items-center">
									<View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-primary/10">
										<Ionicons
											name="person"
											size={24}
											className="text-primary"
										/>
									</View>
									<View className="flex-1">
										<Typography
											variant="body"
											className="font-semibold text-foreground"
										>
											{session?.user?.name || "User"}
										</Typography>
										<Typography
											variant="caption"
											className="text-foreground/60"
										>
											{session?.user?.email}
										</Typography>
									</View>
									<Ionicons
										name="chevron-forward"
										size={20}
										className="text-foreground/40"
									/>
								</View>
								{isAdmin && (
									<View className="mt-2 flex-row">
										<View className="inline-flex rounded-full bg-warning/10 px-3 py-1">
											<Typography variant="caption" className="text-warning">
												Admin Access
											</Typography>
										</View>
									</View>
								)}
							</View>
						</Card>
					</Pressable>
				</ScrollView>
			</View>
		</Container>
	);
}
