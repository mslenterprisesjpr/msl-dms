import React from "react";
import { Text, useColorScheme, View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

interface MslLogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	showTagline?: boolean;
	tagline?: string;
	className?: string;
}

export function MslLogo({
	size = "md",
	showTagline = false,
	tagline = "Distribute  •  Deliver  •  Grow",
	className = "",
}: MslLogoProps) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";

	const primaryTextColor = isDark ? "#ffffff" : "#0f274a";
	const taglineColor = isDark ? "#94a3b8" : "#475569";

	// Dimension presets
	const scale =
		size === "sm" ? 0.75 : size === "lg" ? 1.3 : size === "xl" ? 1.6 : 1;

	const svgWidth = 120 * scale;
	const svgHeight = 64 * scale;

	return (
		<View className={`items-center justify-center ${className}`}>
			{/* Top Arc & Lettering SVG */}
			<View
				style={{
					width: svgWidth,
					height: svgHeight,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Svg
					width={svgWidth}
					height={svgHeight}
					viewBox="0 0 160 84"
					fill="none"
				>
					<Defs>
						<LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
							<Stop offset="0%" stopColor="#f59e0b" />
							<Stop offset="100%" stopColor="#d97706" />
						</LinearGradient>
						<LinearGradient id="navyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
							<Stop offset="0%" stopColor={isDark ? "#38bdf8" : "#1e3a8a"} />
							<Stop offset="100%" stopColor={isDark ? "#0284c7" : "#0f274a"} />
						</LinearGradient>
					</Defs>

					{/* Top Arch Swooshes (Gold upper, Navy/Sky lower) */}
					{/* Gold swoosh over top-left to top-center */}
					<Path
						d="M 28 42 C 28 16, 75 4, 115 14 C 95 6, 50 14, 40 40 Z"
						fill="url(#goldGrad)"
					/>
					{/* Navy/Sky swoosh hugging right side of the circle */}
					<Path
						d="M 85 8 C 122 14, 138 32, 136 58 C 132 40, 114 18, 75 12 Z"
						fill="url(#navyGrad)"
					/>
				</Svg>

				{/* Overlaid MSL Text centered below arc */}
				<View
					style={{
						position: "absolute",
						bottom: 2 * scale,
						flexDirection: "row",
						alignItems: "baseline",
					}}
				>
					<Text
						style={{
							fontSize: 32 * scale,
							fontWeight: "900",
							color: primaryTextColor,
							letterSpacing: -1,
						}}
					>
						MS
					</Text>
					<Text
						style={{
							fontSize: 32 * scale,
							fontWeight: "900",
							color: "#f59e0b",
							letterSpacing: -1,
						}}
					>
						L
					</Text>
				</View>
			</View>

			{/* Sub-brand ENTERPRISES */}
			<Text
				style={{
					fontSize: 10 * scale,
					fontWeight: "800",
					color: primaryTextColor,
					letterSpacing: 3 * scale,
					marginTop: 2 * scale,
				}}
			>
				ENTERPRISES
			</Text>

			{/* Tagline */}
			{showTagline && (
				<Text
					style={{
						fontSize: 11 * scale,
						fontWeight: "500",
						color: taglineColor,
						letterSpacing: 0.5,
						marginTop: 10 * scale,
					}}
				>
					{tagline}
				</Text>
			)}
		</View>
	);
}
