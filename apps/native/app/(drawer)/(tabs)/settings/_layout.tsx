import { Stack } from "expo-router";

export default function SettingsLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: true,
			}}
		>
			<Stack.Screen
				name="index"
				options={{
					headerTitle: "Settings",
				}}
			/>
			<Stack.Screen
				name="profile"
				options={{
					headerTitle: "User Profile",
				}}
			/>
			<Stack.Screen
				name="users"
				options={{
					headerTitle: "User Management",
				}}
			/>
		</Stack>
	);
}
