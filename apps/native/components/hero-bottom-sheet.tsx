import { BottomSheet } from "heroui-native";
import type React from "react";
import { View } from "react-native";

export interface HeroBottomSheetProps {
	visible: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	snapPoints?: (string | number)[];
}

/**
 * Official HeroUI Native BottomSheet component wrapper.
 * Perfect for pickers, lists, and bottom selection flows.
 */
export function HeroBottomSheet({
	visible,
	onClose,
	title,
	subtitle,
	children,
	footer,
	snapPoints = ["60%", "85%"],
}: HeroBottomSheetProps) {
	return (
		<BottomSheet
			isOpen={visible}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<BottomSheet.Portal>
				<BottomSheet.Overlay />
				<BottomSheet.Content snapPoints={snapPoints}>
					<View className="mb-4 flex-row items-start justify-between px-1">
						<View className="flex-1 pr-3">
							<BottomSheet.Title className="font-bold text-foreground text-xl">
								{title}
							</BottomSheet.Title>
							{subtitle ? (
								<BottomSheet.Description className="mt-1 text-foreground/60 text-xs">
									{subtitle}
								</BottomSheet.Description>
							) : null}
						</View>
						<BottomSheet.Close />
					</View>

					<View className="flex-1 px-1">{children}</View>

					{footer && (
						<View className="border-border/20 border-t px-1 pt-4">
							{footer}
						</View>
					)}
				</BottomSheet.Content>
			</BottomSheet.Portal>
		</BottomSheet>
	);
}
