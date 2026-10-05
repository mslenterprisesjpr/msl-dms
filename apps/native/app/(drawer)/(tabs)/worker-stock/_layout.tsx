import { Stack } from "expo-router";

export default function WorkerStockLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false,
			}}
		>
			<Stack.Screen name="index" />
			<Stack.Screen name="issue" />
			<Stack.Screen name="return" />
			<Stack.Screen name="history" />
			<Stack.Screen name="all-workers" />
		</Stack>
	);
}
