import { Stack } from "expo-router";

export default function ProductsLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false,
			}}
		>
			<Stack.Screen name="index" />
			<Stack.Screen
				name="create"
				options={{
					presentation: "modal",
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="stock-history"
				options={{
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="stock-entry"
				options={{
					presentation: "modal",
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="[id]"
				options={{
					presentation: "modal",
					headerShown: false,
				}}
			/>
		</Stack>
	);
}
