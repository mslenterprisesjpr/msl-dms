import { Dialog } from "heroui-native";
import type React from "react";
import { useEffect } from "react";
import { Dimensions, Keyboard, Platform, ScrollView, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";

export interface BottomSheetModalProps {
	visible: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	maxHeightPercentage?: number;
}

/**
 * Native modal powered by HeroUI Native's official Dialog component
 * with keyboard avoidance and smooth scrollable content.
 */
export function BottomSheetModal({
	visible,
	onClose,
	title,
	subtitle,
	children,
	footer,
	maxHeightPercentage = 85,
}: BottomSheetModalProps) {
	const screenHeight = Dimensions.get("window").height;
	const maxModalHeight = (screenHeight * maxHeightPercentage) / 100;

	// Animated value for keyboard offset
	const keyboardOffset = useSharedValue(0);

	useEffect(() => {
		const keyboardWillShow = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
			(e) => {
				keyboardOffset.value = withSpring(-e.endCoordinates.height / 2, {
					damping: 20,
					stiffness: 100,
				});
			},
		);

		const keyboardWillHide = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
			() => {
				keyboardOffset.value = withSpring(0, {
					damping: 20,
					stiffness: 100,
				});
			},
		);

		return () => {
			keyboardWillShow.remove();
			keyboardWillHide.remove();
		};
	}, []);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [{ translateY: keyboardOffset.value }],
		};
	});

	return (
		<Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
			<Dialog.Portal>
				<Dialog.Overlay
					variant="blur"
					blurViewProps={{ intensity: 80 }}
					className="bg-black/60"
				/>
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						paddingHorizontal: 16,
					}}
				>
					<Animated.View
						style={[{ width: "100%", maxWidth: 500 }, animatedStyle]}
					>
						<Dialog.Content
							style={{
								width: "100%",
								maxHeight: maxModalHeight,
								minHeight: 200,
							}}
						>
							{/* Header with HeroUI Native Title, Description and Close Button */}
							<View className="flex-row items-start justify-between">
								<View className="flex-1 pr-3">
									<Dialog.Title className="font-bold text-foreground text-xl">
										{title}
									</Dialog.Title>
									{subtitle ? (
										<Dialog.Description className="mt-1 text-foreground/60 text-sm">
											{subtitle}
										</Dialog.Description>
									) : null}
								</View>
								<Dialog.Close />
							</View>

							{/* Scrollable Form Body */}
							<ScrollView
								keyboardShouldPersistTaps="handled"
								keyboardDismissMode="interactive"
								showsVerticalScrollIndicator={false}
								style={{
									flexGrow: 1,
									flexShrink: 1,
									marginTop: 16,
									marginBottom: footer ? 16 : 0,
								}}
								contentContainerStyle={{
									flexGrow: 1,
									paddingVertical: 8,
								}}
							>
								{children}
							</ScrollView>

							{/* Action Buttons Footer */}
							{footer && (
								<View className="border-border/20 border-t pt-4">{footer}</View>
							)}
						</Dialog.Content>
					</Animated.View>
				</View>
			</Dialog.Portal>
		</Dialog>
	);
}

// Export alias for semantic clarity
export const HeroDialogModal = BottomSheetModal;
