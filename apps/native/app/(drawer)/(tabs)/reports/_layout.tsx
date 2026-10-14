import { Stack } from "expo-router";

export default function ReportsLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: true,
			}}
		>
			<Stack.Screen
				name="index"
				options={{
					headerTitle: "Reports & Analytics",
				}}
			/>
		</Stack>
	);
}
