import { Stack } from "expo-router";

export default function StockLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: true,
			}}
		>
			<Stack.Screen
				name="index"
				options={{
					headerTitle: "Inventory Stock",
				}}
			/>
			<Stack.Screen
				name="entry"
				options={{
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(product)/list"
				options={{
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(product)/create"
				options={{
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(product)/edit"
				options={{
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(product)/[id]"
				options={{
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="history"
				options={{
					headerTitle: "Stock History",
				}}
			/>
			<Stack.Screen
				name="issue"
				options={{
					headerTitle: "Issue Stock",
				}}
			/>
			<Stack.Screen
				name="return"
				options={{
					headerTitle: "Return Stock",
				}}
			/>
		</Stack>
	);
}
