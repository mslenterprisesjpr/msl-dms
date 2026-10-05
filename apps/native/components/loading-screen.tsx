import { Spinner, Typography } from "heroui-native";
import type { ComponentProps } from "react";
import { useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LoadingScreenProps = {
	/**
	 * Main loading message to display
	 * @default "Loading..."
	 */
	message?: string;
	/**
	 * Optional subtitle or description
	 */
	subtitle?: string;
	/**
	 * Spinner size
	 * @default "lg"
	 */
	size?: ComponentProps<typeof Spinner>["size"];
};

export function LoadingScreen({
	message = "Loading...",
	subtitle,
	size = "lg",
}: LoadingScreenProps) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";

	// Theme colors
	const backgroundColor = isDark ? "#000000" : "#FFFFFF";

	return (
		<SafeAreaView
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
				backgroundColor,
			}}
		>
			{/* Main content container */}
			<View
				style={{
					alignItems: "center",
					justifyContent: "center",
					gap: 20,
					paddingHorizontal: 32,
				}}
			>
				{/* HeroUI Native Spinner */}
				<Spinner size={size} />

				{/* Loading message */}
				<View style={{ alignItems: "center", gap: 10, maxWidth: 300 }}>
					<Typography
						variant="title2"
						className="font-semibold text-foreground"
						style={{ textAlign: "center" }}
					>
						{message}
					</Typography>

					{/* Optional subtitle */}
					{subtitle && (
						<Typography
							variant="body"
							className="text-foreground/60"
							style={{ textAlign: "center", lineHeight: 20 }}
						>
							{subtitle}
						</Typography>
					)}
				</View>
			</View>
		</SafeAreaView>
	);
}
