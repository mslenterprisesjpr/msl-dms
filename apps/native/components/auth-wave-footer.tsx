import React from "react";
import { Dimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export function AuthWaveFooter({ height = 90 }: { height?: number }) {
	const screenWidth = Dimensions.get("window").width;

	return (
		<View
			style={{
				width: screenWidth,
				height,
				overflow: "hidden",
			}}
			pointerEvents="none"
		>
			<Svg
				width={screenWidth}
				height={height}
				viewBox="0 0 375 90"
				preserveAspectRatio="none"
			>
				{/* Top Yellow/Gold Wave */}
				<Path
					d="M 0 65 Q 110 95, 230 40 T 375 25 L 375 90 L 0 90 Z"
					fill="#f59e0b"
				/>
				{/* Bottom Deep Navy Blue Wave */}
				<Path
					d="M 0 78 Q 115 105, 230 52 T 375 38 L 375 90 L 0 90 Z"
					fill="#0f274a"
				/>
			</Svg>
		</View>
	);
}
