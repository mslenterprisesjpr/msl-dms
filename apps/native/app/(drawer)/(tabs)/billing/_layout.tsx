import { Stack } from "expo-router";

export default function BillingLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: true,
			}}
		>
			<Stack.Screen
				name="index"
				options={{
					headerTitle: "Billing & Invoices",
				}}
			/>
			<Stack.Screen
				name="create"
				options={{
					headerTitle: "Create New Bill",
				}}
			/>
		</Stack>
	);
}
