import React from "react";
import { Pressable, Text, View } from "react-native";
import { AuthWaveFooter } from "@/components/auth-wave-footer";
import { MslLogo } from "@/components/msl-logo";

interface AuthWelcomeProps {
	onLoginPress: () => void;
	onCreateAccountPress: () => void;
}

export function AuthWelcome({
	onLoginPress,
	onCreateAccountPress,
}: AuthWelcomeProps) {
	return (
		<View className="flex-1 justify-between bg-white dark:bg-zinc-950">
			{/* Top Spacer */}
			<View className="h-6" />

			{/* Center Content: MSL Logo, Welcome, Buttons */}
			<View className="items-center px-6">
				{/* MSL Enterprises Logo with Tagline */}
				<MslLogo
					size="xl"
					showTagline
					tagline="Distribute  •  Deliver  •  Grow"
					className="mb-14"
				/>

				{/* Welcome Title & Subtitle */}
				<Text className="font-extrabold text-2xl text-[#0f274a] dark:text-white">
					Welcome
				</Text>
				<Text className="mt-2 text-center font-medium text-slate-500 text-sm dark:text-slate-400">
					Your trusted distribution partner
				</Text>

				{/* Primary & Secondary Action Buttons */}
				<View className="mt-12 w-full max-w-sm gap-3.5">
					{/* Navy Blue Filled Login Button */}
					<Pressable
						onPress={onLoginPress}
						className="items-center justify-center rounded-xl bg-[#0f274a] py-3.5 shadow-sm active:opacity-90 dark:bg-blue-900"
					>
						<Text className="font-bold text-base text-white">Login</Text>
					</Pressable>

					{/* White Outlined Create Account Button */}
					<Pressable
						onPress={onCreateAccountPress}
						className="items-center justify-center rounded-xl border-2 border-[#0f274a] bg-white py-3.5 active:bg-slate-50 dark:border-blue-400 dark:bg-zinc-900"
					>
						<Text className="font-bold text-[#0f274a] text-base dark:text-blue-400">
							Create Account
						</Text>
					</Pressable>
				</View>
			</View>

			{/* Bottom Decorative Gold & Navy Wave Graphic */}
			<View className="w-full items-center">
				<AuthWaveFooter height={100} />
			</View>
		</View>
	);
}
