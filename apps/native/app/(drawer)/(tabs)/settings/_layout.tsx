import { Stack } from "expo-router";
import { useAppHeader } from "@/hooks/use-app-header";

export default function SettingsLayout() {
	const { rootTabHeaderOptions, detailHeaderOptions } = useAppHeader();

	return (
		<Stack>
			<Stack.Screen name="index" options={rootTabHeaderOptions("Settings")} />
			<Stack.Screen
				name="profile"
				options={detailHeaderOptions("User Profile")}
			/>
			<Stack.Screen
				name="users"
				options={detailHeaderOptions("User Management")}
			/>
		</Stack>
	);
}
