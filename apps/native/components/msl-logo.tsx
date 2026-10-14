import React from "react";
import {
	Image,
	type ImageStyle,
	type StyleProp,
	StyleSheet,
	Text,
	useColorScheme,
	View,
} from "react-native";

export const MSL_LOGO_IMAGE = require("@/assets/images/msl-logo.png");

interface MslLogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	dimension?: number;
	showTagline?: boolean;
	tagline?: string;
	className?: string;
	style?: StyleProp<ImageStyle>;
}

export function MslLogo({
	size = "md",
	dimension,
	showTagline = false,
	tagline = "Distribute  •  Deliver  •  Grow",
	className = "",
	style,
}: MslLogoProps) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";
	const taglineColor = isDark ? "#94a3b8" : "#475569";

	// Default size presets (width & height in points)
	const sizeMap = {
		sm: 54,
		md: 78,
		lg: 110,
		xl: 150,
	};

	const logoSize = dimension || sizeMap[size] || 78;
	const borderRadius = Math.round(logoSize * 0.18);

	return (
		<View className={`items-center justify-center ${className}`}>
			<View
				style={[
					styles.imageContainer,
					{
						width: logoSize,
						height: logoSize,
						borderRadius,
					},
					isDark && styles.darkContainer,
				]}
			>
				<Image
					source={MSL_LOGO_IMAGE}
					style={[
						{
							width: logoSize,
							height: logoSize,
							borderRadius,
						},
						style,
					]}
					resizeMode="cover"
				/>
			</View>

			{showTagline && (
				<Text
					style={[
						styles.tagline,
						{
							color: taglineColor,
							fontSize: size === "sm" ? 10 : size === "xl" ? 13 : 11,
						},
					]}
				>
					{tagline}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	imageContainer: {
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	darkContainer: {
		backgroundColor: "#ffffff",
		shadowColor: "#38bdf8",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 10,
		elevation: 4,
	},
	tagline: {
		fontWeight: "600",
		letterSpacing: 0.5,
		marginTop: 8,
		textAlign: "center",
	},
});
