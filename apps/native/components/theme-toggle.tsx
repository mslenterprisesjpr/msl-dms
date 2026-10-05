import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { useAppTheme } from "@/contexts/app-theme-context";

const StyledIonicons = withUniwind(Ionicons);

export function ThemeToggle() {
	const { toggleTheme, isLight } = useAppTheme();

	return (
		<Pressable
			onPress={() => {
				if (Platform.OS === "ios") {
					Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
				}
				toggleTheme();
			}}
			className="px-2.5"
		>
			{isLight ? (
				<View key="moon">
					<StyledIonicons name="moon" size={20} className="text-foreground" />
				</View>
			) : (
				<View key="sun">
					<StyledIonicons name="sunny" size={20} className="text-foreground" />
				</View>
			)}
		</Pressable>
	);
}
