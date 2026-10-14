import { Stack } from "expo-router";
import React from "react";
import { useAppHeader } from "@/hooks/use-app-header";

export default function SystemAdminLayout() {
	const { rootTabHeaderOptions, detailHeaderOptions } = useAppHeader();

	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={rootTabHeaderOptions("Platform Super Admin")}
			/>
		</Stack>
	);
}
