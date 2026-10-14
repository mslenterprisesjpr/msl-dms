import React from "react";
import { SplashScreen } from "@/components/splash-screen";

type LoadingScreenProps = {
	message?: string;
	subtitle?: string;
	size?: any;
};

export function LoadingScreen({
	message = "Loading...",
	subtitle,
}: LoadingScreenProps) {
	return (
		<SplashScreen message={subtitle ? `${message} (${subtitle})` : message} />
	);
}
