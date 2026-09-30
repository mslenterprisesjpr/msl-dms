import { Card, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";

export default function Home() {
	const { data: session } = authClient.useSession();
	const [isLogin, setIsLogin] = useState(true);

	const _mutedColor = useThemeColor("muted");
	const _successColor = useThemeColor("success");
	const _dangerColor = useThemeColor("danger");
	const _foregroundColor = useThemeColor("foreground");

	const toggleLogin = () => {
		setIsLogin((prev) => !prev);
	};

	return (
		<Container className="p-6">
			<View className="mb-6 py-4">
				<Text className="mb-2 font-bold text-4xl text-foreground">
					BETTER T STACK
				</Text>
			</View>

			{session?.user ? (
				<Card variant="secondary" className="mb-6 p-4">
					<Text className="mb-2 text-base text-foreground">
						Welcome, <Text className="font-medium">{session.user.name}</Text>
					</Text>
					<Text className="mb-4 text-muted text-sm">{session.user.email}</Text>
					<Pressable
						className="self-start rounded-lg bg-danger px-4 py-3 active:opacity-70"
						onPress={() => {
							authClient.signOut();
						}}
					>
						<Text className="font-medium text-foreground">Sign Out</Text>
					</Pressable>
				</Card>
			) : null}

			{!session?.user && (
				<View className="flex-1">
					{isLogin ? <SignIn /> : <SignUp />}
					<Pressable
						className="mt-6 items-center p-2 active:opacity-70"
						onPress={toggleLogin}
					>
						<Text className="font-medium text-foreground">
							{isLogin
								? "Don't have an account? Sign up"
								: "Already have an account? Sign in"}
						</Text>
					</Pressable>
				</View>
			)}
		</Container>
	);
}
