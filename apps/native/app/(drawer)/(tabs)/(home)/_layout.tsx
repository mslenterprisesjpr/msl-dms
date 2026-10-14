import { Stack } from "expo-router";
import { useAppHeader } from "@/hooks/use-app-header";

export default function HomeLayout() {
	const { rootTabHeaderOptions } = useAppHeader();

	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={rootTabHeaderOptions("MSL Enterprises")}
			/>
		</Stack>
	);
}
