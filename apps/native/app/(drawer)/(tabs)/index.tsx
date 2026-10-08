import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Card, Typography } from "heroui-native";
import React from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { useAdminStats, useWorkerStats } from "@/hooks/queries/use-dashboard";
import { useSession } from "@/lib/hooks/use-session";

const StyledIonicons = withUniwind(Ionicons);

export default function Home() {
	const { session, user, isLoading, refetch: refetchSession } = useSession();
	const [refreshing, setRefreshing] = React.useState(false);
	const refetchRef = React.useRef<(() => Promise<void>) | null>(null);

	// Determine user role
	const isAdmin = user?.role === "admin";
	const isWorker = user?.role === "worker";

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		try {
			// Refetch session
			await refetchSession();

			// Refetch dashboard data if refetch function is provided
			if (refetchRef.current) {
				await refetchRef.current();
			}
		} catch (error) {
			console.error("Refresh error:", error);
		} finally {
			setRefreshing(false);
		}
	}, [refetchSession]);

	if (isLoading) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Typography variant="body" className="text-foreground/60">
					Loading...
				</Typography>
			</Container>
		);
	}

	if (!user) {
		return (
			<Container className="flex-1 items-center justify-center p-6">
				<Card className="items-center p-8">
					<StyledIonicons
						name="log-in-outline"
						size={48}
						className="text-foreground/30"
					/>
					<Typography variant="title2" className="mt-4 mb-2 text-foreground">
						Please Login
					</Typography>
					<Typography variant="body" className="text-center text-foreground/60">
						Login to access the dashboard
					</Typography>
				</Card>
			</Container>
		);
	}

	return (
		<Container className="flex-1" isScrollable={false}>
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16 }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor="#0ea5e9"
						colors={["#0ea5e9"]}
					/>
				}
			>
				{/* Header */}
				<View className="mb-6">
					<Typography variant="title1" className="text-foreground">
						Dashboard
					</Typography>
					<Typography variant="body" className="mt-1 text-foreground/60">
						Welcome back, {user.name || user.email}
					</Typography>
					{isAdmin && (
						<View className="mt-2">
							<View className="inline-flex self-start rounded-full bg-accent/10 px-3 py-1">
								<Typography variant="caption" className="text-accent">
									Admin Access
								</Typography>
							</View>
						</View>
					)}
					{isWorker && (
						<View className="mt-2">
							<View className="inline-flex self-start rounded-full bg-success/10 px-3 py-1">
								<Typography variant="caption" className="text-success">
									Worker
								</Typography>
							</View>
						</View>
					)}
				</View>

				{/* Admin Dashboard */}
				{isAdmin && <AdminDashboard refetchRef={refetchRef} />}

				{/* Worker Dashboard */}
				{isWorker && <WorkerDashboard refetchRef={refetchRef} />}

				{/* Default Dashboard for other roles */}
				{!isAdmin && !isWorker && <DefaultDashboard />}
			</ScrollView>
		</Container>
	);
}

// Admin Dashboard Component
function AdminDashboard({
	refetchRef,
}: {
	refetchRef: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
	const { data: stats, refetch: refetchStats } = useAdminStats();

	const totalProducts = stats?.totalProducts ?? 0;
	const totalCustomers = stats?.totalCustomers ?? 0;
	const pendingOrders = stats?.pendingOrders ?? 0;
	const monthlyRevenue = stats?.monthlyRevenue ?? 0;

	// Store refetch function in ref
	React.useEffect(() => {
		refetchRef.current = async () => {
			await refetchStats();
		};
	}, [refetchStats, refetchRef]);

	const quickActions = [
		{
			icon: "cube-outline" as const,
			title: "Products",
			description: "Manage products & inventory",
			route: "/products",
			color: "text-accent",
			bg: "bg-accent/10",
		},
		{
			icon: "people-outline" as const,
			title: "Customers",
			description: "View & manage customers",
			route: "/customers",
			color: "text-success",
			bg: "bg-success/10",
		},
		{
			icon: "business-outline" as const,
			title: "Organizations",
			description: "Manage organizations",
			route: "/organizations",
			color: "text-warning",
			bg: "bg-warning/10",
		},
		{
			icon: "settings-outline" as const,
			title: "Settings",
			description: "App settings & preferences",
			route: "/settings",
			color: "text-foreground",
			bg: "bg-default",
		},
	];

	return (
		<View>
			{/* Statistics Cards */}
			<View className="mb-6">
				<Typography variant="title2" className="mb-4 text-foreground">
					Overview
				</Typography>
				<View className="flex-row flex-wrap gap-3">
					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-accent/10 p-2">
									<StyledIonicons
										name="cube-outline"
										size={20}
										className="text-accent"
									/>
								</View>
								<StyledIonicons
									name="trending-up"
									size={16}
									className="text-success"
								/>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								{totalProducts}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Total Products
							</Typography>
						</View>
					</Card>

					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-success/10 p-2">
									<StyledIonicons
										name="people-outline"
										size={20}
										className="text-success"
									/>
								</View>
								<StyledIonicons
									name="trending-up"
									size={16}
									className="text-success"
								/>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								{totalCustomers}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Total Customers
							</Typography>
						</View>
					</Card>

					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-warning/10 p-2">
									<StyledIonicons
										name="cart-outline"
										size={20}
										className="text-warning"
									/>
								</View>
								<StyledIonicons
									name="trending-down"
									size={16}
									className="text-danger"
								/>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								{pendingOrders}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Pending Orders
							</Typography>
						</View>
					</Card>

					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-danger/10 p-2">
									<StyledIonicons
										name="cash-outline"
										size={20}
										className="text-danger"
									/>
								</View>
								<StyledIonicons
									name="trending-up"
									size={16}
									className="text-success"
								/>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								₹{monthlyRevenue.toLocaleString("en-IN")}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Revenue (Month)
							</Typography>
						</View>
					</Card>
				</View>
			</View>

			{/* Quick Actions */}
			<View>
				<Typography variant="title2" className="mb-4 text-foreground">
					Quick Actions
				</Typography>
				<View className="gap-3">
					{quickActions.map((action) => (
						<Pressable
							key={action.route}
							onPress={() => router.push(action.route as any)}
						>
							<Card>
								<View className="flex-row items-center p-4">
									<View className={`mr-4 rounded-full p-3 ${action.bg}`}>
										<StyledIonicons
											name={action.icon}
											size={24}
											className={action.color}
										/>
									</View>
									<View className="flex-1">
										<Typography
											variant="body"
											className="font-semibold text-foreground"
										>
											{action.title}
										</Typography>
										<Typography
											variant="caption"
											className="mt-1 text-foreground/60"
										>
											{action.description}
										</Typography>
									</View>
									<StyledIonicons
										name="chevron-forward"
										size={20}
										className="text-foreground/40"
									/>
								</View>
							</Card>
						</Pressable>
					))}
				</View>
			</View>
		</View>
	);
}

// Worker Dashboard Component
function WorkerDashboard({
	refetchRef,
}: {
	refetchRef: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
	const { data: stats, refetch: refetchStats } = useWorkerStats();

	const totalStockItems = stats?.totalStockItems ?? 0;
	const issuedToday = stats?.issuedToday ?? 0;
	const returnsToday = stats?.returnsToday ?? 0;
	const lowStockItems = stats?.lowStockItems ?? 0;

	// Store refetch function in ref
	React.useEffect(() => {
		refetchRef.current = async () => {
			await refetchStats();
		};
	}, [refetchStats, refetchRef]);

	const workerActions = [
		{
			icon: "cube-outline" as const,
			title: "My Stock",
			description: "View assigned stock",
			route: "/worker-stock",
			color: "text-accent",
			bg: "bg-accent/10",
		},
		{
			icon: "add-circle-outline" as const,
			title: "Issue Stock",
			description: "Issue stock to customers",
			route: "/worker-stock/issue",
			color: "text-warning",
			bg: "bg-warning/10",
		},
		{
			icon: "return-down-back-outline" as const,
			title: "Return Stock",
			description: "Return stock to inventory",
			route: "/worker-stock/return",
			color: "text-success",
			bg: "bg-success/10",
		},
		{
			icon: "person-outline" as const,
			title: "Profile",
			description: "View your profile",
			route: "/settings/profile",
			color: "text-foreground",
			bg: "bg-default",
		},
	];

	return (
		<View>
			{/* Worker Stats */}
			<View className="mb-6">
				<Typography variant="title2" className="mb-4 text-foreground">
					My Stats
				</Typography>
				<View className="flex-row flex-wrap gap-3">
					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-accent/10 p-2">
									<StyledIonicons
										name="cube-outline"
										size={20}
										className="text-accent"
									/>
								</View>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								{totalStockItems}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Stock Items
							</Typography>
						</View>
					</Card>

					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-success/10 p-2">
									<StyledIonicons
										name="checkmark-circle-outline"
										size={20}
										className="text-success"
									/>
								</View>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								{issuedToday}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Issued Today
							</Typography>
						</View>
					</Card>

					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-warning/10 p-2">
									<StyledIonicons
										name="return-down-back-outline"
										size={20}
										className="text-warning"
									/>
								</View>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								{returnsToday}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Returns Today
							</Typography>
						</View>
					</Card>

					<Card className="min-w-[45%] flex-1">
						<View className="p-4">
							<View className="mb-2 flex-row items-center justify-between">
								<View className="rounded-full bg-danger/10 p-2">
									<StyledIonicons
										name="alert-circle-outline"
										size={20}
										className="text-danger"
									/>
								</View>
							</View>
							<Typography
								variant="title1"
								className="font-bold text-foreground"
							>
								{lowStockItems}
							</Typography>
							<Typography variant="caption" className="text-foreground/60">
								Low Stock Items
							</Typography>
						</View>
					</Card>
				</View>
			</View>

			{/* Quick Actions */}
			<View>
				<Typography variant="title2" className="mb-4 text-foreground">
					Quick Actions
				</Typography>
				<View className="gap-3">
					{workerActions.map((action) => (
						<Pressable
							key={action.route}
							onPress={() => router.push(action.route as any)}
						>
							<Card>
								<View className="flex-row items-center p-4">
									<View className={`mr-4 rounded-full p-3 ${action.bg}`}>
										<StyledIonicons
											name={action.icon}
											size={24}
											className={action.color}
										/>
									</View>
									<View className="flex-1">
										<Typography
											variant="body"
											className="font-semibold text-foreground"
										>
											{action.title}
										</Typography>
										<Typography
											variant="caption"
											className="mt-1 text-foreground/60"
										>
											{action.description}
										</Typography>
									</View>
									<StyledIonicons
										name="chevron-forward"
										size={20}
										className="text-foreground/40"
									/>
								</View>
							</Card>
						</Pressable>
					))}
				</View>
			</View>
		</View>
	);
}

// Default Dashboard for other roles
function DefaultDashboard() {
	return (
		<View className="flex-1 items-center justify-center py-12">
			<Card className="items-center p-8">
				<StyledIonicons
					name="information-circle-outline"
					size={48}
					className="text-foreground/30"
				/>
				<Typography variant="title2" className="mt-4 mb-2 text-foreground">
					Welcome
				</Typography>
				<Typography variant="body" className="text-center text-foreground/60">
					Your dashboard will appear here based on your role
				</Typography>
			</Card>
		</View>
	);
}
