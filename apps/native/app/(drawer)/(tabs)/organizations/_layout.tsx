import { Stack } from "expo-router";
import { useAppHeader } from "@/hooks/use-app-header";

export default function OrganizationsLayout() {
	const { rootTabHeaderOptions } = useAppHeader();

	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={rootTabHeaderOptions("Organizations & Agencies")}
			/>
		</Stack>
	);
}
