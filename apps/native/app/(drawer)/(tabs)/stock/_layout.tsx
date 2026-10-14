import { Stack } from "expo-router";
import { useAppHeader } from "@/hooks/use-app-header";

export default function StockLayout() {
	const { rootTabHeaderOptions, detailHeaderOptions } = useAppHeader();

	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={rootTabHeaderOptions("Inventory Stock")}
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
				options={detailHeaderOptions("Stock History")}
			/>
			<Stack.Screen name="issue" options={detailHeaderOptions("Issue Stock")} />
			<Stack.Screen
				name="return"
				options={detailHeaderOptions("Return Stock")}
			/>
		</Stack>
	);
}
