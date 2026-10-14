import React, { useEffect, useRef } from "react";
import {
	ActivityIndicator,
	Animated,
	Easing,
	StyleSheet,
	Text,
	useColorScheme,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MslLogo } from "@/components/msl-logo";

interface SplashScreenProps {
	message?: string;
	showIndicator?: boolean;
}

export function SplashScreen({
	message = "Loading...",
	showIndicator = true,
}: SplashScreenProps) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";
	const insets = useSafeAreaInsets();

	const fadeAnim = useRef(new Animated.Value(0)).current;
	const scaleAnim = useRef(new Animated.Value(0.92)).current;
	const pulseAnim = useRef(new Animated.Value(0.4)).current;

	useEffect(() => {
		// Smooth entrance animation
		Animated.parallel([
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 450,
				easing: Easing.out(Easing.ease),
				useNativeDriver: true,
			}),
			Animated.spring(scaleAnim, {
				toValue: 1,
				friction: 7,
				tension: 40,
				useNativeDriver: true,
			}),
		]).start();

		// Subtle ambient pulse for the glow
		const pulseLoop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulseAnim, {
					toValue: 0.9,
					duration: 1200,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
				Animated.timing(pulseAnim, {
					toValue: 0.4,
					duration: 1200,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
			]),
		);
		pulseLoop.start();

		return () => {
			pulseLoop.stop();
		};
	}, [fadeAnim, scaleAnim, pulseAnim]);

	const bgColor = isDark ? "#090d16" : "#ffffff";
	const textColor = isDark ? "#ffffff" : "#0f274a";
	const subtitleColor = isDark ? "#94a3b8" : "#64748b";
	const glowColor = isDark
		? "rgba(56, 189, 248, 0.15)"
		: "rgba(245, 158, 11, 0.12)";

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: bgColor,
					paddingTop: insets.top,
					paddingBottom: insets.bottom + 16,
				},
			]}
		>
			{/* Ambient Center Glow */}
			<Animated.View
				style={[
					styles.glowCircle,
					{
						backgroundColor: glowColor,
						opacity: pulseAnim,
						transform: [{ scale: scaleAnim }],
					},
				]}
			/>

			{/* Main Branding Block */}
			<Animated.View
				style={[
					styles.content,
					{
						opacity: fadeAnim,
						transform: [{ scale: scaleAnim }],
					},
				]}
			>
				{/* Logo */}
				<View style={styles.logoWrapper}>
					<MslLogo size="xl" showTagline={false} />
				</View>

				{/* App Title */}
				<Text style={[styles.title, { color: textColor }]}>MSL DMS</Text>

				{/* Tagline */}
				<Text style={[styles.tagline, { color: subtitleColor }]}>
					Distribution Management System
				</Text>
			</Animated.View>

			{/* Bottom Loading Indicator & Status */}
			<Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
				{showIndicator && (
					<View style={styles.indicatorRow}>
						<ActivityIndicator size="small" color="#f59e0b" />
						{message ? (
							<Text style={[styles.message, { color: subtitleColor }]}>
								{message}
							</Text>
						) : null}
					</View>
				)}

				<Text
					style={[
						styles.versionText,
						{ color: isDark ? "#475569" : "#94a3b8" },
					]}
				>
					Secure Enterprise Edition • v1.0.0
				</Text>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 24,
	},
	glowCircle: {
		position: "absolute",
		top: "35%",
		width: 260,
		height: 260,
		borderRadius: 130,
	},
	content: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
	},
	logoWrapper: {
		marginBottom: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 22,
		fontWeight: "900",
		letterSpacing: 2,
		marginTop: 8,
	},
	tagline: {
		fontSize: 13,
		fontWeight: "500",
		letterSpacing: 0.5,
		marginTop: 6,
	},
	footer: {
		alignItems: "center",
		gap: 12,
		width: "100%",
		paddingBottom: 8,
	},
	indicatorRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	message: {
		fontSize: 12,
		fontWeight: "600",
		letterSpacing: 0.3,
	},
	versionText: {
		fontSize: 11,
		fontWeight: "500",
		letterSpacing: 0.5,
	},
});
