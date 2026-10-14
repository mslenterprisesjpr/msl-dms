import { Stack } from "expo-router";
import { useAppHeader } from "@/hooks/use-app-header";

export default function ReportsLayout() {
	const { rootTabHeaderOptions } = useAppHeader();

	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={rootTabHeaderOptions("Reports & Analytics")}
			/>
		</Stack>
	);
}
