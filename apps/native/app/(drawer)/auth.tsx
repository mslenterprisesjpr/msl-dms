import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthWaveFooter } from "@/components/auth-wave-footer";
import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { SplashScreen } from "@/components/splash-screen";
import { authClient } from "@/lib/auth-client";

export default function AuthScreen() {
	const { data: session, isPending } = authClient.useSession();
	const [isLogin, setIsLogin] = useState(true);
	const insets = useSafeAreaInsets();

	// If already authenticated, directly and smoothly redirect to the main app dashboard!
	useEffect(() => {
		if (session?.user) {
			router.replace("/(drawer)/(tabs)" as any);
		}
	}, [session?.user]);

	// While checking session or if already logged in, show animated Splash Screen
	if (isPending || session?.user) {
		return (
			<SplashScreen
				message={
					session?.user ? "Welcome back! Opening app..." : "Authenticating..."
				}
			/>
		);
	}

	// Direct smooth Auth: Single screen with Login & Register toggle, MSL Logo and Wave footer
	return (
		<Container className="bg-white dark:bg-zinc-950" isScrollable={false}>
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					flexGrow: 1,
					justifyContent: "space-between",
					paddingTop: Math.max(insets.top + 8, 20),
				}}
				keyboardShouldPersistTaps="handled"
			>
				{/* Main Auth Form (Login by default, switchable to Register) */}
				<View className="px-6 py-4">
					{isLogin ? (
						<SignIn onSwitchToSignUp={() => setIsLogin(false)} />
					) : (
						<SignUp onSwitchToSignIn={() => setIsLogin(true)} />
					)}
				</View>

				{/* Bottom Wave Decoration */}
				<View className="w-full items-center">
					<AuthWaveFooter height={75} />
				</View>
			</ScrollView>
		</Container>
	);
}
