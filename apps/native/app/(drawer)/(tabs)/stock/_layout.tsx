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
				options={detailHeaderOptions("Add Stock Entry")}
			/>
			<Stack.Screen
				name="(product)/list"
				options={detailHeaderOptions("Product Catalog")}
			/>
			<Stack.Screen
				name="(product)/create"
				options={detailHeaderOptions("Add / Edit Product")}
			/>
			<Stack.Screen
				name="(product)/edit"
				options={detailHeaderOptions("Edit Product")}
			/>
			<Stack.Screen
				name="(product)/[id]"
				options={detailHeaderOptions("Product Details")}
			/>
			<Stack.Screen
				name="history"
				options={detailHeaderOptions("Stock History")}
			/>
			<Stack.Screen
				name="issue"
				options={detailHeaderOptions("Issue Stock to Worker")}
			/>
			<Stack.Screen
				name="return"
				options={detailHeaderOptions("Return Stock")}
			/>
			<Stack.Screen
				name="workers"
				options={detailHeaderOptions("Van Stock & Day-End Closing")}
			/>
		</Stack>
	);
}
