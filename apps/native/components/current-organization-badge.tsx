import { Ionicons } from "@expo/vector-icons";
import { Chip, Text } from "heroui-native";
import { View } from "react-native";

import { useOrganizationStore } from "@/lib/stores/organization-store";

export function CurrentOrganizationBadge() {
	const { getCurrentOrg } = useOrganizationStore();
	const currentOrg = getCurrentOrg();

	if (!currentOrg) {
		return (
			<Chip
				variant="flat"
				color="warning"
				startContent={<Ionicons name="warning-outline" size={14} />}
			>
				No Org Selected
			</Chip>
		);
	}

	return (
		<View className="flex-row items-center gap-2">
			<Ionicons name="business" size={16} color="#888" />
			<Text className="font-medium text-sm">{currentOrg.name}</Text>
		</View>
	);
}
