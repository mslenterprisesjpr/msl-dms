import { Stack } from "expo-router";
import { useAppHeader } from "@/hooks/use-app-header";

export default function BillingLayout() {
	const { rootTabHeaderOptions, detailHeaderOptions } = useAppHeader();

	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={rootTabHeaderOptions("Billing & Invoices")}
			/>
			<Stack.Screen
				name="create"
				options={detailHeaderOptions("Create New Bill")}
			/>
			<Stack.Screen
				name="customer-create"
				options={detailHeaderOptions("Add Customer")}
			/>
			<Stack.Screen
				name="customer-khata"
				options={detailHeaderOptions("Customer Khata / Ledger")}
			/>
			<Stack.Screen
				name="[id]"
				options={detailHeaderOptions("Invoice Details & Slip")}
			/>
		</Stack>
	);
}
