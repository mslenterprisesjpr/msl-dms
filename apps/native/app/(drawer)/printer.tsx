import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	Text,
	View,
} from "react-native";

import { Container } from "@/components/container";
import {
	connectToPrinter,
	disconnectPrinter,
	getSavedPrinter,
	type PrinterDevice,
	printTestPage,
	scanBluetoothPrinters,
} from "@/utils/printer-helper";

export default function PrinterScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");

	const [devices, setDevices] = useState<PrinterDevice[]>([]);
	const [connected, setConnected] = useState<PrinterDevice | null>(null);
	const [loading, setLoading] = useState(false);
	const [connectingMac, setConnectingMac] = useState<string | null>(null);
	const [scanError, setScanError] = useState<string | null>(null);

	// Load previously saved printer
	useEffect(() => {
		(async () => {
			const saved = await getSavedPrinter();
			if (saved) {
				setConnected(saved);
			}
		})();
	}, []);

	// Scan Bluetooth devices
	const scan = useCallback(async () => {
		try {
			setLoading(true);
			setScanError(null);
			const list = await scanBluetoothPrinters();
			setDevices(list || []);

			if (!list || list.length === 0) {
				const msg =
					"Koi printer nahi mila. Pehle phone ki Bluetooth settings me printer pair karein, fir Scan dabayein.";
				setScanError(msg);
			}
		} catch (e: any) {
			const errorMsg = String(e?.message || e);
			setScanError(errorMsg);
			Alert.alert("Bluetooth Scan Error", errorMsg);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		scan();
	}, [scan]);

	// Connect to device
	const handleConnect = async (device: PrinterDevice) => {
		try {
			setConnectingMac(device.inner_mac_address);
			await connectToPrinter(device);
			setConnected(device);
			toast.show({
				variant: "success",
				label: `Connected to ${device.device_name || "Thermal Printer"}!`,
			});
		} catch (e: any) {
			Alert.alert("Connect Error", String(e?.message || e));
		} finally {
			setConnectingMac(null);
		}
	};

	// Disconnect
	const handleDisconnect = async () => {
		try {
			await disconnectPrinter();
			setConnected(null);
			toast.show({
				variant: "default",
				label: "Printer disconnected",
			});
		} catch (e: any) {
			Alert.alert("Disconnect Error", String(e?.message || e));
		}
	};

	// Test print
	const handleTestPrint = async () => {
		if (!connected) {
			Alert.alert(
				"Printer Required",
				"Pehle Bluetooth thermal printer connect karein.",
			);
			return;
		}

		try {
			const res = await printTestPage();
			if (res.success) {
				toast.show({
					variant: "success",
					label: "Test slip printed successfully!",
				});
			} else {
				Alert.alert("Print Error", String(res.error));
			}
		} catch (e: any) {
			Alert.alert("Print Error", String(e?.message || e));
		}
	};

	return (
		<Container
			isScrollable={false}
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
		>
			{/* Top Header */}
			<View className="flex-row items-center justify-between border-slate-200 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
				<View className="flex-row items-center gap-2.5">
					<Pressable
						onPress={() => router.back()}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons
							name="arrow-back"
							size={18}
							color={themeColorForeground}
						/>
					</Pressable>
					<View>
						<Text className="font-bold text-base text-slate-900 dark:text-white">
							POS Thermal Printer
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							SEZNIK 58mm / 80mm Bluetooth ESC/POS
						</Text>
					</View>
				</View>

				{/* Quick Scan */}
				<Pressable
					onPress={scan}
					disabled={loading}
					className="h-9 items-center justify-center rounded-xl bg-accent px-3 active:opacity-80"
				>
					{loading ? (
						<ActivityIndicator size="small" color="#ffffff" />
					) : (
						<View className="flex-row items-center gap-1">
							<Ionicons name="refresh" size={14} color="#ffffff" />
							<Text className="font-bold text-accent-foreground text-xs">
								Scan
							</Text>
						</View>
					)}
				</Pressable>
			</View>

			<View className="flex-1 p-4">
				{/* 1. CURRENT CONNECTION CARD */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center justify-between">
						<View className="flex-1 flex-row items-center gap-3">
							<View
								className={`h-12 w-12 items-center justify-center rounded-2xl ${
									connected
										? "bg-emerald-500/15 text-emerald-600"
										: "bg-slate-100 text-slate-400 dark:bg-zinc-800"
								}`}
							>
								<Ionicons
									name="print"
									size={24}
									color={connected ? "#10b981" : "#94a3b8"}
								/>
							</View>
							<View className="flex-1">
								<Text className="font-semibold text-slate-400 text-xs uppercase tracking-wider dark:text-zinc-500">
									Active POS Status
								</Text>
								<Text className="font-black text-base text-slate-900 dark:text-white">
									{connected
										? connected.device_name || "Paired Printer"
										: "No Printer Connected"}
								</Text>
								<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
									{connected
										? `MAC: ${connected.inner_mac_address}`
										: "Tap below to scan & connect bluetooth device"}
								</Text>
							</View>
						</View>

						{/* Badge */}
						<View
							className={`rounded-full px-2.5 py-0.5 ${
								connected
									? "bg-emerald-100 dark:bg-emerald-950/60"
									: "bg-slate-100 dark:bg-zinc-800"
							}`}
						>
							<Text
								className={`font-bold text-[10px] ${
									connected
										? "text-emerald-700 dark:text-emerald-300"
										: "text-slate-500"
								}`}
							>
								{connected ? "READY" : "OFFLINE"}
							</Text>
						</View>
					</View>

					{/* Action Buttons for Connected Printer */}
					{connected && (
						<View className="mt-4 flex-row items-center gap-2 border-slate-100 border-t pt-3 dark:border-zinc-800">
							<Pressable
								onPress={handleTestPrint}
								className="flex-1 flex-row items-center justify-center rounded-xl bg-emerald-600 py-2.5 active:opacity-90"
							>
								<Ionicons
									name="document-text-outline"
									size={16}
									color="#ffffff"
								/>
								<Text className="ml-1.5 font-bold text-white text-xs">
									Test Slip Print
								</Text>
							</Pressable>

							<Pressable
								onPress={handleDisconnect}
								className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 active:bg-rose-100 dark:border-rose-950 dark:bg-rose-950/30"
							>
								<Text className="font-bold text-rose-700 text-xs dark:text-rose-300">
									Disconnect
								</Text>
							</Pressable>
						</View>
					)}
				</Card>

				{/* 2. INSTRUCTIONS / WARNING */}
				<View className="mb-3 rounded-2xl bg-sky-50/80 p-3 dark:bg-sky-950/30">
					<View className="flex-row items-center gap-2">
						<Ionicons name="bluetooth" size={16} color="#0284c7" />
						<Text className="font-bold text-sky-900 text-xs dark:text-sky-200">
							Thermal Bluetooth Pairing Guide
						</Text>
					</View>
					<Text className="mt-1 text-[11px] text-sky-800 leading-4 dark:text-sky-300">
						1. Printer on karein aur mobile Settings -&gt; Bluetooth me jakar
						printer pair karein (PIN: 0000 ya 1234).{"\n"}
						2. Yahan "Scan" dabayein aur printer select karke Connect karein.
					</Text>
				</View>

				{/* 3. DISCOVERED PRINTERS LIST */}
				<View className="flex-1">
					<View className="mb-2 flex-row items-center justify-between">
						<Text className="font-bold text-slate-800 text-sm dark:text-white">
							Available Bluetooth Printers ({devices.length})
						</Text>
						{loading && (
							<Text className="font-medium text-slate-400 text-xs">
								Scanning...
							</Text>
						)}
					</View>

					<FlatList
						data={devices}
						keyExtractor={(item) => item.inner_mac_address}
						showsVerticalScrollIndicator={false}
						ListEmptyComponent={
							!loading ? (
								<View className="items-center py-10">
									<Ionicons name="print-outline" size={42} color="#cbd5e1" />
									<Text className="mt-2 font-bold text-slate-700 text-sm dark:text-zinc-300">
										{scanError
											? "Scan Dobara Try Karein"
											: "Koi Printer Nahi Mila"}
									</Text>
									<Text className="mt-1 px-6 text-center text-slate-400 text-xs">
										{scanError ||
											"Pehle phone ke Bluetooth me printer ko pair karein, fir Scan dabayein."}
									</Text>
									<Pressable
										onPress={scan}
										className="mt-4 rounded-xl bg-accent px-4 py-2"
									>
										<Text className="font-bold text-accent-foreground text-xs">
											Scan Again
										</Text>
									</Pressable>
								</View>
							) : null
						}
						renderItem={({ item }) => {
							const isConnected =
								connected?.inner_mac_address === item.inner_mac_address;
							const isConnecting = connectingMac === item.inner_mac_address;

							return (
								<Pressable
									onPress={() => !isConnected && handleConnect(item)}
									className={`mb-2.5 flex-row items-center justify-between rounded-2xl border p-3.5 shadow-2xs active:opacity-85 ${
										isConnected
											? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30"
											: "border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
									}`}
								>
									<View className="flex-1 pr-3">
										<View className="flex-row items-center gap-1.5">
											<Ionicons
												name="print"
												size={16}
												color={isConnected ? "#10b981" : "#64748b"}
											/>
											<Text className="font-bold text-slate-900 text-sm dark:text-white">
												{item.device_name || "Unknown Thermal Printer"}
											</Text>
										</View>
										<Text className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-zinc-500">
											MAC: {item.inner_mac_address}
										</Text>
									</View>

									{isConnecting ? (
										<ActivityIndicator size="small" color={themeAccent} />
									) : isConnected ? (
										<View className="flex-row items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 dark:bg-emerald-900/40">
											<Ionicons
												name="checkmark-circle"
												size={14}
												color="#10b981"
											/>
											<Text className="font-bold text-emerald-700 text-xs dark:text-emerald-300">
												Connected
											</Text>
										</View>
									) : (
										<View className="rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-zinc-800">
											<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
												Connect ➔
											</Text>
										</View>
									)}
								</Pressable>
							);
						}}
					/>
				</View>
			</View>
		</Container>
	);
}
