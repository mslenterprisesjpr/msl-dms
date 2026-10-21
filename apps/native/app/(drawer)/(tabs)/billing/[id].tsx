import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { Card, useThemeColor, useToast } from "heroui-native";
import React, { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	Share,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { Container } from "@/components/container";
import { DialogModal } from "@/components/dialog-modal";
import { HeroBottomSheet } from "@/components/hero-bottom-sheet";
import { useCreatePayment } from "@/hooks/queries/use-payments";
import { useSale } from "@/hooks/queries/use-sales";
import { authClient } from "@/lib/auth-client";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import type { SaleItem } from "@/services/sale.service";
import {
	buildReceiptText,
	connectToPrinter,
	disconnectPrinter,
	formatReceiptForDisplay,
	getFontConfig,
	getSavedFontSize,
	getSavedPrinter,
	type PrinterDevice,
	type PrintFontSize,
	printSaleInvoice,
	type ReceiptData,
	saveFontSize,
	scanBluetoothPrinters,
} from "@/utils/printer-helper";

export default function InvoiceDetailScreen() {
	const router = useRouter();
	const { toast } = useToast();
	const insets = useSafeAreaInsets();
	const themeAccent = useThemeColor("accent");
	const themeColorForeground = useThemeColor("foreground");

	const { id, openPayment } = useLocalSearchParams<{
		id: string;
		openPayment?: string;
	}>();
	const { data: session } = authClient.useSession();
	const currentUserId = session?.user?.id || "";
	const currentOrg = useOrganizationStore((s) => s.getCurrentOrg());

	// Safe parse organization metadata (handles JSON string or object)
	const orgMeta = useMemo(() => {
		if (!currentOrg?.metadata) return {};
		if (typeof currentOrg.metadata === "string") {
			try {
				return JSON.parse(currentOrg.metadata);
			} catch {
				return {};
			}
		}
		return (currentOrg.metadata as Record<string, any>) || {};
	}, [currentOrg]);

	// Device-local Store details fallback
	const [localStoreGstin, setLocalStoreGstin] = useState("");
	const [localStorePhone, setLocalStorePhone] = useState("");
	const [localStoreAddr, setLocalStoreAddr] = useState("");

	useEffect(() => {
		AsyncStorage.getItem("@msl_store_gstin").then((val) => {
			if (val) setLocalStoreGstin(val);
		});
		AsyncStorage.getItem("@msl_store_phone").then((val) => {
			if (val) setLocalStorePhone(val);
		});
		AsyncStorage.getItem("@msl_store_address").then((val) => {
			if (val) setLocalStoreAddr(val);
		});
	}, []);

	const sellerGstin =
		(orgMeta.gstin as string) ||
		(orgMeta.gstNumber as string) ||
		(orgMeta.gst as string) ||
		(currentOrg as any)?.gstNumber ||
		(currentOrg as any)?.gstin ||
		localStoreGstin ||
		"";
	const sellerPhone =
		(orgMeta.phone as string) ||
		(currentOrg as any)?.phone ||
		localStorePhone ||
		"";
	const sellerAddr =
		(orgMeta.address as string) ||
		(currentOrg as any)?.address ||
		localStoreAddr ||
		"Jaipur, Rajasthan";

	// Quick prompt to configure Store GSTIN if missing
	const [isEditStoreModalOpen, setIsEditStoreModalOpen] = useState(false);
	const [tempStoreGstin, setTempStoreGstin] = useState("");

	const handleEditStoreGstin = () => {
		setTempStoreGstin(sellerGstin);
		setIsEditStoreModalOpen(true);
	};

	const handleSaveStoreGstin = async () => {
		const clean = tempStoreGstin.trim().toUpperCase();
		setLocalStoreGstin(clean);
		await AsyncStorage.setItem("@msl_store_gstin", clean);
		setIsEditStoreModalOpen(false);
		toast.show({
			variant: "success",
			label: clean ? `Store GSTIN saved: ${clean}` : "Store GSTIN cleared",
		});
	};

	// Fetch Sale Detail
	const { data: sale, isLoading, refetch } = useSale(id || "");
	const createPaymentMutation = useCreatePayment();

	const [refreshing, setRefreshing] = useState(false);

	// Collect Balance Payment Modal
	const [paymentModalVisible, setPaymentModalVisible] = useState(false);
	const [paymentAmount, setPaymentAmount] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD">(
		"CASH",
	);
	const [paymentNote, setPaymentNote] = useState("");

	// POS Thermal Printer State
	const [printerModalVisible, setPrinterModalVisible] = useState(false);
	const [activePrinter, setActivePrinter] = useState<PrinterDevice | null>(
		null,
	);
	const [isPrinting, setIsPrinting] = useState(false);
	const [scannedPrinters, setScannedPrinters] = useState<PrinterDevice[]>([]);
	const [isScanningPrinters, setIsScanningPrinters] = useState(false);
	const [connectingMac, setConnectingMac] = useState<string | null>(null);
	const [showReceiptPreview, setShowReceiptPreview] = useState(true);
	const [printFontSize, setPrintFontSize] = useState<PrintFontSize>("large");
	const [isSharingImage, setIsSharingImage] = useState(false);
	const receiptCardRef = React.useRef<View>(null);

	// Load saved printer and font size on mount
	useEffect(() => {
		(async () => {
			const saved = await getSavedPrinter();
			if (saved) setActivePrinter(saved);
			const savedSize = await getSavedFontSize();
			if (savedSize) setPrintFontSize(savedSize);
		})();
	}, []);

	const handleSelectFontSize = (size: PrintFontSize) => {
		setPrintFontSize(size);
		saveFontSize(size);
	};

	// Handle Direct POS Print
	const handlePosPrint = async () => {
		if (!sale) return;

		let printer = activePrinter;
		if (!printer) {
			printer = await getSavedPrinter();
			if (printer) setActivePrinter(printer);
		}

		if (!printer) {
			setPrinterModalVisible(true);
			handleScanPrinters();
			return;
		}

		setIsPrinting(true);
		try {
			// Auto reconnect to saved printer before sending print data
			try {
				await connectToPrinter(printer);
			} catch (connErr: any) {
				console.log("Printer connect error on print:", connErr);
				Alert.alert(
					"Printer Off / Disconnected",
					`"${printer.device_name || "POS Printer"}" se Bluetooth connect nahi ho paya.\n\nKripya check karein:\n1. Printer machine ON hai ya nahi.\n2. Phone ka Bluetooth ON hai ya nahi.\n3. Printer mobile ki Bluetooth range mein hai.`,
					[
						{ text: "Theek Hai", style: "cancel" },
						{
							text: "Select / Scan Printer",
							onPress: () => {
								setPrinterModalVisible(true);
								handleScanPrinters();
							},
						},
					],
				);
				return;
			}

			const res = await printSaleInvoice(sale, {
				storeName: currentOrg?.name,
				gstin: sellerGstin,
				phone: sellerPhone,
				address: sellerAddr,
				fontSize: printFontSize,
			});
			if (res.success) {
				toast.show({
					variant: "success",
					label: `Printed on ${printer.device_name || "POS Printer"}!`,
				});
			} else {
				Alert.alert(
					"Print Failed",
					"Printer se print nahi ho paya. Bluetooth check karein ya reconnect karein.",
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Select Printer",
							onPress: () => {
								setPrinterModalVisible(true);
								handleScanPrinters();
							},
						},
					],
				);
			}
		} catch (e: any) {
			Alert.alert("Print Error", String(e?.message || e));
		} finally {
			setIsPrinting(false);
		}
	};

	const handleScanPrinters = async () => {
		try {
			setIsScanningPrinters(true);
			const list = await scanBluetoothPrinters();
			setScannedPrinters(list || []);
		} catch (e: any) {
			Alert.alert("Bluetooth Scan Error", String(e?.message || e));
		} finally {
			setIsScanningPrinters(false);
		}
	};

	const handleConnectPrinter = async (dev: PrinterDevice) => {
		try {
			setConnectingMac(dev.inner_mac_address);
			await connectToPrinter(dev);
			setActivePrinter(dev);
			toast.show({
				variant: "success",
				label: `Connected to ${dev.device_name || "Thermal Printer"}!`,
			});
			setPrinterModalVisible(false);
		} catch (e: any) {
			Alert.alert("Connect Error", String(e?.message || e));
		} finally {
			setConnectingMac(null);
		}
	};

	const handleDisconnectPrinter = async () => {
		try {
			await disconnectPrinter();
			setActivePrinter(null);
			toast.show({
				variant: "info",
				label: "Printer unpaired / removed",
			});
		} catch (e: any) {
			console.log("Disconnect error:", e);
		}
	};

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	const customer =
		typeof sale?.customerId === "object" ? sale.customerId : null;
	const customerIdStr =
		customer?._id ||
		(typeof sale?.customerId === "string" ? sale.customerId : "");
	const customerName = customer?.name || "Counter Customer";
	const customerPhone = customer?.phone || "";
	const customerAddress = customer?.address || "";
	const customerGst = customer?.gstNumber || "";

	const items: SaleItem[] = sale?.items || [];
	const payments = sale?.payments || [];
	const isPaid = sale?.paymentStatus === "PAID";
	const isPartial = sale?.paymentStatus === "PARTIAL";
	const isPending = sale?.paymentStatus === "PENDING";
	const pendingBalance = sale?.pendingAmount ?? 0;

	// Auto-open payment collection modal if requested via route params
	React.useEffect(() => {
		if (openPayment === "true" && pendingBalance > 0 && !paymentModalVisible) {
			setPaymentAmount(pendingBalance.toString());
			setPaymentMethod("CASH");
			setPaymentNote("");
			setPaymentModalVisible(true);
		}
	}, [openPayment, pendingBalance, paymentModalVisible]);

	// Total Cases & Units across items
	const itemsTotals = useMemo(() => {
		let totalCases = 0;
		let totalUnits = 0;
		items.forEach((item) => {
			totalCases += item.cases || 0;
			totalUnits += item.quantity || 0;
		});
		return { totalCases, totalUnits, totalItems: items.length };
	}, [items]);

	// Live 58mm Thermal Receipt text (matches physical POS printout; width follows font mode)
	const receiptPreviewText = useMemo(() => {
		if (!sale) return "";
		const receiptData: ReceiptData = {
			storeName: currentOrg?.name || "MSL ENTERPRISES",
			storeAddress: sellerAddr || "Jaipur, Rajasthan",
			phone: sellerPhone || "",
			gstin: sellerGstin || "",
			billNumber: sale.invoiceNo || sale._id.slice(-6).toUpperCase(),
			date: new Date(sale.saleDate || sale.createdAt || new Date()),
			customerName,
			customerPhone,
			customerGst,
			items: items.map((i) => {
				const p = typeof i.productId === "object" ? i.productId : null;
				return {
					name: p?.name || "Product Item",
					cases: i.cases || 0,
					units: i.units || 0,
					quantity: i.quantity || 0,
					unit: p?.unit || "pcs",
					price: i.price || 0,
					total: i.total || (i.quantity || 0) * (i.price || 0),
					gstRate: p?.gstRate ?? 0,
					cgst: p?.cgst,
					sgst: p?.sgst,
				};
			}),
			subtotal: sale.subtotal || sale.total,
			discount: sale.discount || 0,
			total: sale.total,
			paidAmount: sale.paidAmount,
			pendingAmount: sale.pendingAmount,
			paymentStatus: sale.paymentStatus,
			payments: sale.payments || [],
			note: sale.note,
		};
		return formatReceiptForDisplay(
			buildReceiptText(receiptData, printFontSize),
			printFontSize,
		);
	}, [
		sale,
		items,
		currentOrg,
		sellerAddr,
		sellerGstin,
		sellerPhone,
		customerName,
		customerPhone,
		customerGst,
		printFontSize,
	]);

	// Open Payment Modal
	const handleOpenPayment = () => {
		if (pendingBalance <= 0) {
			toast.show({
				variant: "success",
				label: "Invoice is already fully paid!",
			});
			return;
		}
		setPaymentAmount(pendingBalance.toString());
		setPaymentMethod("CASH");
		setPaymentNote("");
		setPaymentModalVisible(true);
	};

	// Submit Payment
	const handleSubmitPayment = async () => {
		if (!sale) return;

		const amountNum = Number.parseFloat(paymentAmount);
		if (!amountNum || amountNum <= 0) {
			toast.show({
				variant: "danger",
				label: "Please enter a valid payment amount",
			});
			return;
		}

		if (amountNum > pendingBalance) {
			toast.show({
				variant: "danger",
				label: `Amount exceeds pending balance of ₹${pendingBalance.toLocaleString("en-IN")}`,
			});
			return;
		}

		try {
			await createPaymentMutation.mutateAsync({
				saleId: sale._id,
				amount: amountNum,
				paymentMethod,
				paymentDate: new Date().toISOString(),
				note: paymentNote.trim() || undefined,
				createdBy: currentUserId,
			});

			toast.show({
				variant: "success",
				label: `Payment of ₹${amountNum.toLocaleString("en-IN")} recorded!`,
			});

			setPaymentModalVisible(false);
			await refetch();
		} catch (error: any) {
			console.error("Payment error:", error);
			Alert.alert(
				"Payment Failed",
				error?.response?.data?.message || "Failed to record payment",
			);
		}
	};

	// Generate Formatted Slip Text (WhatsApp / Share) — matches printed receipt
	const generateSlipText = () => {
		if (!sale) return "";

		const saleDate = new Date(sale.saleDate || sale.createdAt);
		const dateStr = saleDate.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
		const timeStr = saleDate.toLocaleTimeString("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});

		const sep = "━━━━━━━━━━━━━━━━━━━━\n";
		const dash = "────────────────────\n";

		let text = "🧾 *POS GST INVOICE*\n";
		text += `*${currentOrg?.name || "MSL ENTERPRISES"}*\n`;
		if (sellerAddr) text += `${sellerAddr}\n`;
		if (sellerGstin) text += `GSTIN: *${sellerGstin}*\n`;
		if (sellerPhone) text += `Ph: ${sellerPhone}\n`;
		text += sep;
		text += `Invoice : *#${sale.invoiceNo}*\n`;
		text += `Date    : ${dateStr} ${timeStr}\n`;
		text += `Party   : *${customerName}*\n`;
		if (customerPhone) text += `Phone   : ${customerPhone}\n`;
		text += `Party GSTIN: *${customerGst || "Unregistered"}*\n`;
		text += dash;

		// Items
		text += "*Item             Qty   Rate   Amt*\n";
		text += dash;
		items.forEach((item) => {
			const prodName =
				typeof item.productId === "object"
					? item.productId.name
					: "Product Item";
			const casesText = (item.cases || 0) > 0 ? `${item.cases}cs` : "";
			const looseText = (item.units || 0) > 0 ? `${item.units}pc` : "";
			const qtyStr =
				casesText && looseText
					? `${casesText}+${looseText}`
					: casesText || looseText || `${item.quantity}`;

			const rateStr = `₹${item.price}`;
			const totStr = `₹${item.total.toFixed(2)}`;

			if (prodName.length > 13) {
				text += `*${prodName}*\n`;
				text += `  ${qtyStr.padEnd(7)}${rateStr.padStart(6)} ${totStr.padStart(8)}\n`;
			} else {
				text += `*${prodName.padEnd(13)}* ${qtyStr.padStart(4)} ${rateStr.padStart(6)} ${totStr.padStart(7)}\n`;
			}
		});
		text += dash;

		// Compute Base / Taxable amounts by backing out GST from item totals (inclusive pricing)
		let totalTaxable = 0;
		type SlabMap = {
			taxable: number;
			cgst: number;
			sgst: number;
			cgstPct: number;
			sgstPct: number;
		};
		const gstSlabs = new Map<number, SlabMap>();

		items.forEach((item) => {
			const prod = typeof item.productId === "object" ? item.productId : null;
			const rate = prod?.gstRate ?? 0;
			const itemGross = item.total ?? item.quantity * item.price;

			let itemTaxable = itemGross;
			let itemGst = 0;
			if (rate > 0) {
				itemTaxable = itemGross / (1 + rate / 100);
				itemGst = itemGross - itemTaxable;
			}
			totalTaxable += itemTaxable;

			if (rate > 0) {
				const cgstPct = prod?.cgst ?? rate / 2;
				const sgstPct = prod?.sgst ?? rate / 2;
				const entry = gstSlabs.get(rate) ?? {
					taxable: 0,
					cgst: 0,
					sgst: 0,
					cgstPct,
					sgstPct,
				};
				entry.taxable += itemTaxable;
				entry.cgst += itemGst / 2;
				entry.sgst += itemGst / 2;
				gstSlabs.set(rate, entry);
			}
		});

		// Financial totals
		const discount = sale.discount || 0;
		const taxableValue = Math.max(0, totalTaxable - discount);

		if (discount > 0) {
			text += `Subtotal           : ₹${totalTaxable.toFixed(2)}\n`;
			text += `Discount           : -₹${discount.toFixed(2)}\n`;
		}
		text += `Taxable Value      : ₹${taxableValue.toFixed(2)}\n`;
		text += dash;

		// GST Breakup per slab
		if (gstSlabs.size > 0) {
			text += "*GST Breakup*\n";
			gstSlabs.forEach((entry, rate) => {
				const slab = `${rate}% slab`;
				text += `CGST ${entry.cgstPct}% (${slab}) : ₹${entry.cgst.toFixed(2)}\n`;
				text += `SGST ${entry.sgstPct}% (${slab}) : ₹${entry.sgst.toFixed(2)}\n`;
			});
			text += dash;
		}

		// Total & Round Off
		const total = sale.total || 0;
		const roundOff = Math.round(total) - total;
		const roundedTotal = Math.round(total);

		if (Math.abs(roundOff) >= 0.01) {
			text += `Total              : ₹${total.toFixed(2)}\n`;
			text += `Round Off          : ${roundOff > 0 ? "+" : ""}${roundOff.toFixed(2)}\n`;
			text += `*Rounded Total     : ₹${roundedTotal.toFixed(2)}*\n`;
		} else {
			text += `*Total Amount      : ₹${roundedTotal.toFixed(2)}*\n`;
		}
		text += dash;

		// Payment Breakup (CASH, UPI, CARD, etc. + Balance Due)
		const methodTotals: Record<string, number> = {};
		if (payments && payments.length > 0) {
			payments.forEach((p) => {
				const m = (p.paymentMethod || "CASH").toUpperCase();
				methodTotals[m] = (methodTotals[m] || 0) + (p.amount || 0);
			});
		}

		const methodsList = Object.keys(methodTotals);
		if (methodsList.length > 0) {
			methodsList.forEach((method) => {
				const label = `Paid (${method})`;
				text += `${label.padEnd(19)}: ₹${methodTotals[method].toFixed(2)}\n`;
			});
			if (methodsList.length > 1) {
				const totalPaid =
					sale.paidAmount ??
					Object.values(methodTotals).reduce((a, b) => a + b, 0);
				text += `Total Paid         : ₹${totalPaid.toFixed(2)}\n`;
			}
		} else if ((sale.paidAmount || 0) > 0) {
			text += `Paid               : ₹${(sale.paidAmount || 0).toFixed(2)}\n`;
		} else {
			text += "Paid               : ₹0.00\n";
		}

		if (pendingBalance > 0) {
			text += `*Balance Due       : ₹${pendingBalance.toFixed(2)}*\n`;
			text +=
				(sale.paidAmount || 0) > 0
					? "Status             : ⚠️ PARTIAL PAYMENT\n"
					: "Status             : ⚠️ PAYMENT PENDING\n";
		} else {
			text += "Status             : ✅ FULLY PAID\n";
		}

		if (sale.note) {
			text += dash;
			text += `Note: ${sale.note}\n`;
		}

		text += sep;
		text += "_GST Included as applicable._\n";
		text += "_Thank You! Visit Again! 🙏_\n";

		return text;
	};

	// Share WhatsApp Slip (Image First, Text Fallback)
	const handleWhatsAppShare = async () => {
		if (isSharingImage) return;

		// 1. Ensure receipt card is visible and captured as Image
		if (!showReceiptPreview) {
			setShowReceiptPreview(true);
			await new Promise((resolve) => setTimeout(resolve, 150));
		}

		if (receiptCardRef.current) {
			setIsSharingImage(true);
			try {
				const uri = await captureRef(receiptCardRef, {
					format: "png",
					quality: 1,
					result: "tmpfile",
				});

				const isAvailable = await Sharing.isAvailableAsync();
				if (isAvailable && uri) {
					await Sharing.shareAsync(uri, {
						mimeType: "image/png",
						dialogTitle: `Invoice #${sale?.invoiceNo || "Slip"}`,
						UTI: "public.png",
					});
					setIsSharingImage(false);
					return;
				}
			} catch (imageErr: any) {
				console.log("ViewShot image capture/share notice:", imageErr);
				toast.show({
					variant: "warning",
					label: "Rebuild dev client to share image. Sharing text.",
				});
			} finally {
				setIsSharingImage(false);
			}
		}

		// 2. Fallback to WhatsApp text share
		const slip = generateSlipText();
		if (!slip) return;

		if (customerPhone) {
			const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
			const phoneWithCountry =
				cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
			const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(slip)}`;

			try {
				const supported = await Linking.canOpenURL(url);
				if (supported) {
					await Linking.openURL(url);
					return;
				}
			} catch (e) {
				console.log(
					"Could not open direct WhatsApp link, falling back to Share:",
					e,
				);
			}
		}

		// Fallback to Native Share sheet
		try {
			await Share.share({
				message: slip,
				title: `Invoice #${sale?.invoiceNo}`,
			});
		} catch (error) {
			console.error("Share error:", error);
		}
	};

	// General Share / Print (Image First)
	const handleGeneralShare = async () => {
		if (!showReceiptPreview) {
			setShowReceiptPreview(true);
			await new Promise((resolve) => setTimeout(resolve, 150));
		}

		if (receiptCardRef.current) {
			try {
				const uri = await captureRef(receiptCardRef, {
					format: "png",
					quality: 1,
					result: "tmpfile",
				});
				const isAvailable = await Sharing.isAvailableAsync();
				if (isAvailable && uri) {
					await Sharing.shareAsync(uri, {
						mimeType: "image/png",
						dialogTitle: `Invoice #${sale?.invoiceNo || "Slip"}`,
						UTI: "public.png",
					});
					return;
				}
			} catch (e) {
				console.log("General share image fallback to text:", e);
			}
		}

		const slip = generateSlipText();
		if (!slip) return;
		try {
			await Share.share({
				message: slip,
				title: `Bill #${sale?.invoiceNo} - ${customerName}`,
			});
		} catch (error) {
			console.error("General share error:", error);
		}
	};

	if (isLoading) {
		return (
			<Container
				isScrollable={false}
				className="flex-1 items-center justify-center bg-slate-50 dark:bg-zinc-950"
			>
				<ActivityIndicator size="large" color={themeAccent || "#0284c7"} />
				<Text className="mt-3 font-semibold text-slate-500 text-xs dark:text-zinc-400">
					Loading invoice details & slip...
				</Text>
			</Container>
		);
	}

	if (!sale) {
		return (
			<Container
				isScrollable={false}
				className="flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-zinc-950"
			>
				<Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
				<Text className="mt-3 font-bold text-base text-slate-800 dark:text-white">
					Invoice Not Found
				</Text>
				<Pressable
					onPress={() => router.back()}
					className="mt-4 rounded-xl bg-slate-200 px-4 py-2 dark:bg-zinc-800"
				>
					<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-200">
						Go Back
					</Text>
				</Pressable>
			</Container>
		);
	}

	return (
		<Container
			isScrollable={false}
			className="flex-1 bg-slate-50 dark:bg-zinc-950"
		>
			{/* Top Action Bar */}
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
							Invoice #{sale.invoiceNo}
						</Text>
						<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
							{new Date(sale.saleDate || sale.createdAt).toLocaleDateString(
								"en-IN",
								{
									day: "numeric",
									month: "short",
									year: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								},
							)}
						</Text>
					</View>
				</View>

				{/* Header Actions */}
				<View className="flex-row items-center gap-2">
					<Pressable
						onPress={() => {
							setPrinterModalVisible(true);
							handleScanPrinters();
						}}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons
							name="print"
							size={17}
							color={activePrinter ? "#10b981" : "#64748b"}
						/>
					</Pressable>
					<Pressable
						onPress={handleGeneralShare}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons name="share-outline" size={17} color="#64748b" />
					</Pressable>
					<Pressable
						onPress={onRefresh}
						disabled={refreshing}
						className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-zinc-800"
						hitSlop={8}
					>
						<Ionicons
							name={refreshing ? "sync" : "refresh-outline"}
							size={16}
							color={themeAccent || "#0284c7"}
						/>
					</Pressable>
				</View>
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={[themeAccent || "#0284c7"]}
						tintColor={themeAccent || "#0284c7"}
					/>
				}
			>
				{/* 1. HERO SLIP HEADER CARD */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="flex-row items-center justify-between border-slate-100 border-b pb-3 dark:border-zinc-800">
						<View>
							<Text className="font-medium text-[11px] text-slate-400 uppercase tracking-wider dark:text-zinc-500">
								TAX INVOICE / CASH MEMO
							</Text>
							<Text className="font-black text-slate-900 text-xl dark:text-white">
								#{sale.invoiceNo}
							</Text>
						</View>

						{/* Payment Status Pill */}
						<View
							className={`rounded-full px-3 py-1 ${
								isPaid
									? "bg-emerald-100 dark:bg-emerald-950/60"
									: isPartial
										? "bg-amber-100 dark:bg-amber-950/60"
										: "bg-rose-100 dark:bg-rose-950/60"
							}`}
						>
							<Text
								className={`font-black text-xs ${
									isPaid
										? "text-emerald-700 dark:text-emerald-300"
										: isPartial
											? "text-amber-700 dark:text-amber-300"
											: "text-rose-700 dark:text-rose-300"
								}`}
							>
								{isPaid ? "PAID IN FULL" : isPartial ? "PARTIAL DUE" : "UNPAID"}
							</Text>
						</View>
					</View>

					{/* Customer Details */}
					<View className="mt-3 flex-row items-center justify-between">
						<View className="flex-1 pr-2">
							<Text className="font-medium text-[11px] text-slate-400 dark:text-zinc-500">
								Billed To:
							</Text>
							<Text className="font-bold text-base text-slate-900 dark:text-white">
								{customerName}
							</Text>
							{customerPhone ? (
								<Text className="mt-0.5 font-medium text-slate-500 text-xs dark:text-zinc-400">
									📞 {customerPhone}
								</Text>
							) : null}
							{customerAddress ? (
								<Text className="mt-0.5 font-medium text-slate-400 text-xs dark:text-zinc-500">
									📍 {customerAddress}
								</Text>
							) : null}
							<Text className="mt-0.5 font-medium text-[11px] text-slate-400">
								Party GSTIN: {customerGst || "Unregistered"}
							</Text>
						</View>

						{/* Quick Customer Action Buttons */}
						<View className="items-end gap-2">
							{customerPhone ? (
								<Pressable
									onPress={() => Linking.openURL(`tel:${customerPhone}`)}
									className="flex-row items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 active:opacity-75 dark:bg-emerald-950/40"
								>
									<Ionicons name="call" size={12} color="#10b981" />
									<Text className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
										Call Party
									</Text>
								</Pressable>
							) : null}

							{customerIdStr ? (
								<Pressable
									onPress={() =>
										router.push({
											pathname: "/billing/customer-khata" as any,
											params: { id: customerIdStr },
										})
									}
									className="flex-row items-center gap-1 rounded-xl bg-sky-50 px-2.5 py-1.5 active:opacity-75 dark:bg-sky-950/40"
								>
									<Ionicons name="book" size={12} color="#0284c7" />
									<Text className="font-bold text-[11px] text-sky-700 dark:text-sky-300">
										View Khata
									</Text>
								</Pressable>
							) : null}
						</View>
					</View>
				</Card>

				{/* 2. DUAL ACTION ROW: WHATSAPP SLIP + POS THERMAL PRINT */}
				<View className="mb-4 flex-row gap-2.5">
					{/* WhatsApp Share Button */}
					<Pressable
						onPress={handleWhatsAppShare}
						disabled={isSharingImage}
						className="flex-1 flex-row items-center justify-between rounded-2xl bg-[#25D366] p-3.5 shadow-sm active:opacity-90"
					>
						<View className="flex-1 flex-row items-center gap-2.5">
							<View className="h-9 w-9 items-center justify-center rounded-xl bg-white/20">
								{isSharingImage ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
								)}
							</View>
							<View className="flex-1">
								<Text className="font-black text-white text-xs">
									{isSharingImage ? "Creating Image..." : "WhatsApp Slip"}
								</Text>
								<Text
									className="font-medium text-[10px] text-white/80"
									numberOfLines={1}
								>
									{isSharingImage
										? "Preparing image slip"
										: customerPhone || "Share Image Slip"}
								</Text>
							</View>
						</View>
						<Ionicons name="image-outline" size={16} color="#ffffff" />
					</Pressable>

					{/* POS Thermal Print Button */}
					<Pressable
						onPress={handlePosPrint}
						disabled={isPrinting}
						className="flex-1 flex-row items-center justify-between rounded-2xl bg-slate-900 p-3.5 shadow-sm active:opacity-90 dark:bg-white"
					>
						<View className="flex-1 flex-row items-center gap-2.5">
							<View className="h-9 w-9 items-center justify-center rounded-xl bg-white/20 dark:bg-zinc-900/10">
								{isPrinting ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Ionicons
										name="print"
										size={20}
										color={
											themeColorForeground === "#ffffff" ? "#09090b" : "#ffffff"
										}
									/>
								)}
							</View>
							<View className="flex-1">
								<Text
									className="font-black text-white text-xs dark:text-zinc-900"
									numberOfLines={1}
								>
									{isPrinting ? "Printing..." : "POS Print"}
								</Text>
								<Text
									className="font-medium text-[10px] text-white/80 dark:text-zinc-500"
									numberOfLines={1}
								>
									{activePrinter
										? activePrinter.device_name || "Thermal 58mm"
										: "Pair Printer ➔"}
								</Text>
							</View>
						</View>
						<View
							className={`h-2 w-2 rounded-full ${
								activePrinter ? "bg-emerald-400" : "bg-amber-400"
							}`}
						/>
					</Pressable>
				</View>

				{/* 2.5 LIVE 2-INCH POS THERMAL RECEIPT SLIP PREVIEW */}
				<Card className="mb-4 overflow-hidden border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Pressable
						onPress={() => setShowReceiptPreview(!showReceiptPreview)}
						className="flex-row items-center justify-between p-3.5"
					>
						<View className="flex-1 flex-row items-center gap-2.5">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800">
								<Ionicons name="receipt-outline" size={17} color="#0f172a" />
							</View>
							<View className="flex-1">
								<Text className="font-bold text-slate-900 text-xs dark:text-white">
									2-Inch POS Thermal Slip Preview
								</Text>
								<Text className="text-[10px] text-slate-400">
									Exact paper printout layout (
									{getFontConfig(printFontSize).cols} columns)
								</Text>
							</View>
						</View>
						<View className="flex-row items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 dark:bg-zinc-800">
							<Text className="font-bold text-[10px] text-slate-600 dark:text-zinc-300">
								{showReceiptPreview ? "Hide Slip" : "View Slip ➔"}
							</Text>
							<Ionicons
								name={showReceiptPreview ? "chevron-up" : "chevron-down"}
								size={14}
								color="#64748b"
							/>
						</View>
					</Pressable>

					{showReceiptPreview && (
						<View className="border-slate-100 border-t bg-slate-100/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
							{/* Seller GSTIN quick status / edit banner */}
							<Pressable
								onPress={handleEditStoreGstin}
								className={`mb-2.5 flex-row items-center justify-between rounded-xl border p-2.5 active:opacity-80 ${
									sellerGstin
										? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20"
										: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
								}`}
							>
								<View className="flex-1 flex-row items-center gap-2">
									<Ionicons
										name={sellerGstin ? "shield-checkmark" : "warning"}
										size={16}
										color={sellerGstin ? "#059669" : "#d97706"}
									/>
									<Text
										className={`font-bold text-[11px] ${
											sellerGstin
												? "text-emerald-900 dark:text-emerald-200"
												: "text-amber-900 dark:text-amber-200"
										}`}
										numberOfLines={1}
									>
										{sellerGstin
											? `Store GSTIN: ${sellerGstin}`
											: "Store GSTIN not set. Tap to add GSTIN"}
									</Text>
								</View>
								<Text
									className={`font-bold text-[10px] ${
										sellerGstin
											? "text-emerald-700 dark:text-emerald-300"
											: "text-amber-700 dark:text-amber-300"
									}`}
								>
									{sellerGstin ? "Change" : "Add GSTIN ➔"}
								</Text>
							</Pressable>
							{/* Print Font Size Selector (Large / Medium / Small) */}
							<View className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
								<View className="flex-row items-center gap-1.5">
									<Ionicons name="text-outline" size={15} color="#64748b" />
									<Text className="font-bold text-[11px] text-slate-700 dark:text-zinc-300">
										Print Text Size:
									</Text>
								</View>
								<View className="flex-row items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-zinc-800">
									{(["large", "medium", "small"] as const).map((sz) => {
										const isSel = printFontSize === sz;
										const label =
											sz === "large"
												? "Large"
												: sz === "medium"
													? "Medium"
													: "Small";
										return (
											<Pressable
												key={sz}
												onPress={() => handleSelectFontSize(sz)}
												className={`rounded-md px-2.5 py-1 ${
													isSel
														? "bg-slate-900 shadow-xs dark:bg-white"
														: "bg-transparent active:opacity-70"
												}`}
											>
												<Text
													className={`font-black text-[10px] ${
														isSel
															? "text-white dark:text-zinc-900"
															: "text-slate-500 dark:text-zinc-400"
													}`}
												>
													{label}
												</Text>
											</Pressable>
										);
									})}
								</View>
							</View>

							{/* Thermal Paper Slip Replica - Always White Paper with Black Ink */}
							<View
								ref={receiptCardRef}
								collapsable={false}
								style={{ width: getFontConfig(printFontSize).previewWidth }}
								className="self-center overflow-hidden rounded-md border border-slate-300 bg-white shadow-md"
							>
								{/* Paper Top Perforation */}
								<View className="flex-row items-center justify-between border-slate-200 border-b border-dashed bg-slate-50 px-3 py-1.5">
									<Text className="font-bold text-[9px] text-slate-400 tracking-wider">
										2-INCH (58MM) THERMAL ROLL
									</Text>
									<Text className="font-semibold text-[9px] text-slate-400 uppercase">
										{printFontSize}
									</Text>
								</View>

								{/* Monospace Receipt Content */}
								<View className="px-3 py-2.5">
									<Text
										className="font-normal text-slate-950"
										style={{
											fontFamily:
												Platform.OS === "ios" ? "Courier" : "monospace",
											fontSize: getFontConfig(printFontSize).previewFontSize,
											lineHeight:
												getFontConfig(printFontSize).previewLineHeight,
										}}
									>
										{receiptPreviewText}
									</Text>
								</View>

								{/* Paper Bottom Perforation */}
								<View className="items-center border-slate-200 border-t border-dashed bg-slate-50 py-1">
									<Text className="font-bold text-[8px] text-slate-400 tracking-widest">
										- - - - - TEAR HERE - - - - -
									</Text>
								</View>
							</View>
						</View>
					)}
				</Card>

				{/* 3. BILLED PRODUCTS LIST (CASES-FIRST) */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<View className="mb-3 flex-row items-center justify-between border-slate-100 border-b pb-2.5 dark:border-zinc-800">
						<Text className="font-bold text-slate-800 text-sm dark:text-white">
							Products Billed ({items.length})
						</Text>
						<View className="rounded-lg bg-sky-50 px-2 py-0.5 dark:bg-sky-950/40">
							<Text className="font-bold text-[11px] text-sky-700 dark:text-sky-300">
								{itemsTotals.totalCases} Cases ({itemsTotals.totalUnits} units)
							</Text>
						</View>
					</View>

					{items.length === 0 ? (
						<Text className="py-4 text-center text-slate-400 text-xs">
							No item records attached to this invoice.
						</Text>
					) : (
						<View className="gap-3">
							{items.map((item, index) => {
								const product =
									typeof item.productId === "object" ? item.productId : null;
								const productName = product?.name || "Product Item";
								const productSku = product?.sku || "";
								const productPack = product?.packSize || "";
								const unitsPerCase = product?.unitsPerCase || 1;
								const cases = item.cases || 0;
								const loose = item.units || 0;

								return (
									<View
										key={item._id || index}
										className="flex-row items-start justify-between border-slate-100 border-b pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800/80"
									>
										{/* Product details */}
										<View className="flex-1 pr-3">
											<Text className="font-bold text-slate-900 text-sm dark:text-white">
												{productName}
											</Text>
											<Text className="mt-0.5 font-medium text-[11px] text-slate-400 dark:text-zinc-500">
												{productSku ? `SKU: ${productSku} • ` : ""}
												{productPack ? `${productPack} • ` : ""}
												{unitsPerCase > 1 ? `${unitsPerCase} pcs/case` : ""}
											</Text>

											{/* Quantity Pill */}
											<View className="mt-1.5 flex-row items-center gap-1.5">
												<View className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-zinc-800">
													<Text className="font-black text-slate-800 text-xs dark:text-zinc-200">
														{cases > 0 ? `${cases} cs` : ""}
														{cases > 0 && loose > 0 ? ` + ${loose} pcs` : ""}
														{cases === 0 ? `${item.quantity} pcs` : ""}
													</Text>
												</View>
												<Text className="font-medium text-[11px] text-slate-400">
													@ ₹{item.price}
												</Text>
											</View>
										</View>

										{/* Total */}
										<View className="items-end">
											<Text className="font-black text-base text-slate-900 dark:text-white">
												₹{item.total.toLocaleString("en-IN")}
											</Text>
											<Text className="font-medium text-[10px] text-slate-400">
												Line Total
											</Text>
										</View>
									</View>
								);
							})}
						</View>
					)}
				</Card>

				{/* 4. FINANCIAL SUMMARY CARD */}
				<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					<Text className="mb-3 font-bold text-slate-800 text-sm dark:text-white">
						Payment & Bill Summary
					</Text>

					<View className="gap-2 border-slate-100 border-b pb-3 dark:border-zinc-800">
						<View className="flex-row items-center justify-between">
							<Text className="font-medium text-slate-500 text-xs dark:text-zinc-400">
								Subtotal
							</Text>
							<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
								₹{(sale.subtotal || 0).toLocaleString("en-IN")}
							</Text>
						</View>

						{(sale.discount || 0) > 0 && (
							<View className="flex-row items-center justify-between">
								<Text className="font-medium text-emerald-600 text-xs dark:text-emerald-400">
									Special Discount
								</Text>
								<Text className="font-bold text-emerald-600 text-xs dark:text-emerald-400">
									- ₹{sale.discount.toLocaleString("en-IN")}
								</Text>
							</View>
						)}

						<View className="mt-1 flex-row items-center justify-between border-slate-100 border-t pt-2 dark:border-zinc-800">
							<Text className="font-semibold text-slate-600 text-xs dark:text-zinc-400">
								Grand Total
							</Text>
							<Text className="font-bold text-slate-800 text-sm dark:text-zinc-200">
								₹{(sale.total || 0).toFixed(2)}
							</Text>
						</View>

						{Math.abs(Math.round(sale.total || 0) - (sale.total || 0)) >
							0.001 && (
							<View className="flex-row items-center justify-between">
								<Text className="font-medium text-slate-400 text-xs dark:text-zinc-500">
									Round Off
								</Text>
								<Text className="font-medium text-slate-600 text-xs dark:text-zinc-400">
									{Math.round(sale.total || 0) - (sale.total || 0) > 0
										? "+"
										: ""}
									{(Math.round(sale.total || 0) - (sale.total || 0)).toFixed(2)}
								</Text>
							</View>
						)}

						<View className="flex-row items-center justify-between pt-1">
							<Text className="font-black text-base text-slate-900 dark:text-white">
								Rounded Total
							</Text>
							<Text className="font-black text-slate-900 text-xl dark:text-white">
								₹{Math.round(sale.total || 0).toFixed(2)}
							</Text>
						</View>
					</View>

					{/* Paid vs Due Split */}
					<View className="mt-3 flex-row gap-3">
						<View className="flex-1 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/25">
							<Text className="font-semibold text-emerald-800 text-xs dark:text-emerald-300">
								Amount Paid
							</Text>
							<Text className="my-0.5 font-black text-emerald-700 text-lg dark:text-emerald-400">
								₹{(sale.paidAmount || 0).toLocaleString("en-IN")}
							</Text>
							<Text
								className="font-medium text-[10px] text-emerald-600/80"
								numberOfLines={1}
							>
								{payments.length > 0
									? payments
											.map(
												(p: any) =>
													`${p.paymentMethod || "CASH"}: ₹${p.amount || 0}`,
											)
											.join(" • ")
									: `${payments.length} payment(s)`}
							</Text>
						</View>

						<View
							className={`flex-1 rounded-2xl p-3 ${
								pendingBalance > 0
									? "bg-rose-50 dark:bg-rose-950/25"
									: "bg-slate-50 dark:bg-zinc-800/40"
							}`}
						>
							<Text
								className={`font-semibold text-xs ${
									pendingBalance > 0
										? "text-rose-800 dark:text-rose-300"
										: "text-slate-500 dark:text-zinc-400"
								}`}
							>
								Balance Due
							</Text>
							<Text
								className={`my-0.5 font-black text-lg ${
									pendingBalance > 0
										? "text-rose-700 dark:text-rose-400"
										: "text-slate-700 dark:text-zinc-300"
								}`}
							>
								₹{pendingBalance.toLocaleString("en-IN")}
							</Text>
							<Text className="font-medium text-[10px] text-slate-400">
								{pendingBalance > 0 ? "Pending collection" : "Zero due"}
							</Text>
						</View>
					</View>

					{/* Collect Balance Button if Pending */}
					{pendingBalance > 0 && (
						<Pressable
							onPress={handleOpenPayment}
							className="mt-3 flex-row items-center justify-center rounded-xl bg-rose-600 py-3 shadow-xs active:opacity-90"
						>
							<Ionicons
								name="cash-outline"
								size={16}
								color="#ffffff"
								style={{ marginRight: 6 }}
							/>
							<Text className="font-bold text-white text-xs">
								Collect Balance (₹{pendingBalance.toLocaleString("en-IN")})
							</Text>
						</Pressable>
					)}
				</Card>

				{/* 5. PAYMENTS HISTORY FOR THIS INVOICE */}
				{payments.length > 0 && (
					<Card className="mb-4 border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<Text className="mb-3 font-bold text-slate-800 text-sm dark:text-white">
							Payment Receipts ({payments.length})
						</Text>

						<View className="gap-2">
							{payments.map((p, idx) => (
								<View
									key={p._id || idx}
									className="flex-row items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60"
								>
									<View className="flex-row items-center gap-2.5">
										<View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60">
											<Ionicons
												name="checkmark-circle"
												size={16}
												color="#10b981"
											/>
										</View>
										<View>
											<Text className="font-bold text-slate-800 text-xs dark:text-zinc-200">
												{p.paymentMethod || "CASH"} Payment
											</Text>
											<Text className="text-[10px] text-slate-400">
												{p.paymentDate
													? new Date(p.paymentDate).toLocaleDateString([], {
															day: "numeric",
															month: "short",
															year: "numeric",
															hour: "2-digit",
															minute: "2-digit",
														})
													: ""}
												{p.note ? ` • ${p.note}` : ""}
											</Text>
										</View>
									</View>

									<Text className="font-bold text-emerald-600 text-sm dark:text-emerald-400">
										+ ₹{(p.amount || 0).toLocaleString("en-IN")}
									</Text>
								</View>
							))}
						</View>
					</Card>
				)}

				{/* 6. BOTTOM ACTION BAR */}
				<View className="flex-row gap-2.5">
					<Pressable
						onPress={handleGeneralShare}
						className="flex-1 flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3 shadow-xs active:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<Ionicons
							name="share-social-outline"
							size={16}
							color={themeColorForeground}
							style={{ marginRight: 6 }}
						/>
						<Text className="font-bold text-slate-700 text-xs dark:text-zinc-200">
							Copy / Share Slip
						</Text>
					</Pressable>

					<Pressable
						onPress={() => {
							router.push({
								pathname: "/billing/create" as any,
								params: { customerId: customerIdStr },
							});
						}}
						className="flex-1 flex-row items-center justify-center rounded-2xl bg-sky-600 py-3 shadow-xs active:opacity-90"
					>
						<Ionicons
							name="add"
							size={18}
							color="#ffffff"
							style={{ marginRight: 4 }}
						/>
						<Text className="font-bold text-white text-xs">New Bill</Text>
					</Pressable>
				</View>
			</ScrollView>

			{/* ================= HEROUI NATIVE BOTTOM SHEET: COLLECT BALANCE PAYMENT ================= */}
			<HeroBottomSheet
				visible={paymentModalVisible}
				onClose={() => setPaymentModalVisible(false)}
				title="Collect Balance Payment"
				subtitle={`Invoice #${sale.invoiceNo} • ${customerName}`}
				snapPoints={["65%", "85%"]}
				footer={
					<View className="flex-row items-center gap-3">
						<Pressable
							onPress={() => setPaymentModalVisible(false)}
							className="flex-1 items-center justify-center rounded-2xl border border-slate-200 py-3 active:opacity-80 dark:border-zinc-800"
						>
							<Text className="font-bold text-slate-700 text-xs dark:text-zinc-300">
								Cancel
							</Text>
						</Pressable>

						<Pressable
							onPress={handleSubmitPayment}
							disabled={createPaymentMutation.isPending}
							className="flex-1 items-center justify-center rounded-2xl bg-emerald-600 py-3 shadow-sm active:opacity-90"
						>
							{createPaymentMutation.isPending ? (
								<ActivityIndicator size="small" color="#ffffff" />
							) : (
								<Text className="font-bold text-white text-xs">
									Record Payment
								</Text>
							)}
						</Pressable>
					</View>
				}
			>
				<ScrollView className="py-1" showsVerticalScrollIndicator={false}>
					{/* Due amount badge */}
					<View className="mb-4 rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/20">
						<Text className="font-semibold text-rose-800 text-xs dark:text-rose-300">
							Remaining Balance Due on this Bill:
						</Text>
						<Text className="font-black text-2xl text-rose-700 dark:text-rose-400">
							₹{pendingBalance.toLocaleString("en-IN")}
						</Text>
					</View>

					{/* Amount input */}
					<View className="mb-4">
						<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
							Amount Received (₹) *
						</Text>
						<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800">
							<Text className="mr-1 font-bold text-base text-slate-500">₹</Text>
							<TextInput
								keyboardType="numeric"
								value={paymentAmount}
								onChangeText={setPaymentAmount}
								placeholder="0"
								placeholderTextColor="#94a3b8"
								className="flex-1 font-bold text-lg text-slate-900 dark:text-white"
							/>
						</View>
					</View>

					{/* Payment method selector */}
					<View className="mb-4">
						<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
							Payment Method *
						</Text>
						<View className="flex-row gap-2">
							{(["CASH", "UPI", "CARD"] as const).map((method) => {
								const isSelected = paymentMethod === method;
								return (
									<Pressable
										key={method}
										onPress={() => setPaymentMethod(method)}
										className={`flex-1 items-center justify-center rounded-xl border py-2.5 ${
											isSelected
												? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
												: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-800"
										}`}
									>
										<Text
											className={`font-bold text-xs ${
												isSelected
													? "text-emerald-700 dark:text-emerald-300"
													: "text-slate-600 dark:text-zinc-400"
											}`}
										>
											{method === "CASH"
												? "💵 Cash"
												: method === "UPI"
													? "📱 UPI / QR"
													: "💳 Card"}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</View>

					{/* Optional note */}
					<View className="mb-2">
						<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
							Note / Reference (Optional)
						</Text>
						<TextInput
							value={paymentNote}
							onChangeText={setPaymentNote}
							placeholder="e.g. Paid at shop, GPay ref #..."
							placeholderTextColor="#94a3b8"
							className="rounded-xl border border-slate-200 bg-white p-2.5 font-medium text-slate-900 text-xs dark:border-zinc-800 dark:bg-zinc-800 dark:text-white"
						/>
					</View>
				</ScrollView>
			</HeroBottomSheet>

			{/* ================= HEROUI NATIVE BOTTOM SHEET: POS BLUETOOTH PRINTER PAIRING ================= */}
			<HeroBottomSheet
				visible={printerModalVisible}
				onClose={() => setPrinterModalVisible(false)}
				title="POS Thermal Printer Setup"
				subtitle="58mm / 80mm Bluetooth ESC/POS receipt printer"
				snapPoints={["65%", "85%"]}
				footer={
					<View className="flex-row items-center gap-3">
						<Pressable
							onPress={handleScanPrinters}
							disabled={isScanningPrinters}
							className="flex-1 flex-row items-center justify-center rounded-2xl border border-slate-200 py-3 active:opacity-80 dark:border-zinc-800"
						>
							{isScanningPrinters ? (
								<ActivityIndicator size="small" color={themeAccent} />
							) : (
								<>
									<Ionicons
										name="refresh"
										size={15}
										color="#0284c7"
										style={{ marginRight: 6 }}
									/>
									<Text className="font-bold text-sky-600 text-xs dark:text-sky-400">
										Scan Nearby Printers
									</Text>
								</>
							)}
						</Pressable>

						{activePrinter && (
							<Pressable
								onPress={handlePosPrint}
								className="flex-1 items-center justify-center rounded-2xl bg-emerald-600 py-3 shadow-sm active:opacity-90"
							>
								<Text className="font-bold text-white text-xs">
									Print Bill Now ➔
								</Text>
							</Pressable>
						)}
					</View>
				}
			>
				<ScrollView className="py-1" showsVerticalScrollIndicator={false}>
					{/* Active Printer Badge */}
					<View className="mb-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center gap-2.5">
								<View
									className={`h-9 w-9 items-center justify-center rounded-xl ${
										activePrinter
											? "bg-emerald-500/15"
											: "bg-slate-200 dark:bg-zinc-800"
									}`}
								>
									<Ionicons
										name="print"
										size={18}
										color={activePrinter ? "#10b981" : "#94a3b8"}
									/>
								</View>
								<View>
									<Text className="font-bold text-slate-900 text-xs dark:text-white">
										{activePrinter
											? activePrinter.device_name || "Paired Printer"
											: "No Printer Paired"}
									</Text>
									<Text className="text-[10px] text-slate-400">
										{activePrinter
											? `MAC: ${activePrinter.inner_mac_address}`
											: "Pair your Bluetooth printer below"}
									</Text>
								</View>
							</View>

							<View className="flex-row items-center gap-2">
								<View
									className={`rounded-full px-2 py-0.5 ${
										activePrinter
											? "bg-emerald-100 dark:bg-emerald-950/60"
											: "bg-slate-200 dark:bg-zinc-800"
									}`}
								>
									<Text
										className={`font-bold text-[9px] ${
											activePrinter
												? "text-emerald-700 dark:text-emerald-300"
												: "text-slate-500"
										}`}
									>
										{activePrinter ? "PAIRED" : "UNPAIRED"}
									</Text>
								</View>
								{activePrinter && (
									<Pressable
										onPress={handleDisconnectPrinter}
										className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 active:opacity-70 dark:border-rose-900 dark:bg-rose-950/40"
									>
										<Text className="font-semibold text-[9px] text-rose-600 dark:text-rose-400">
											Forget
										</Text>
									</Pressable>
								)}
							</View>
						</View>
					</View>

					{/* Bluetooth Device List */}
					<Text className="mb-2 font-bold text-slate-700 text-xs dark:text-zinc-300">
						Available Bluetooth Printers:
					</Text>

					{isScanningPrinters ? (
						<View className="items-center py-8">
							<ActivityIndicator size="small" color={themeAccent} />
							<Text className="mt-2 text-slate-400 text-xs">
								Scanning Bluetooth devices...
							</Text>
						</View>
					) : scannedPrinters.length === 0 ? (
						<View className="items-center py-6">
							<Ionicons name="bluetooth-outline" size={32} color="#cbd5e1" />
							<Text className="mt-2 text-center text-slate-500 text-xs">
								Koi printer nahi mila. Phone settings me pehle printer pair
								karein, fir "Scan" dabayein.
							</Text>
						</View>
					) : (
						<View className="gap-2 pb-4">
							{scannedPrinters.map((dev) => {
								const isConnected =
									activePrinter?.inner_mac_address === dev.inner_mac_address;
								const isConnecting = connectingMac === dev.inner_mac_address;

								return (
									<Pressable
										key={dev.inner_mac_address}
										onPress={() => !isConnected && handleConnectPrinter(dev)}
										className={`flex-row items-center justify-between rounded-xl border p-3 ${
											isConnected
												? "border-emerald-500 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30"
												: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-800"
										}`}
									>
										<View className="flex-1 pr-2">
											<Text className="font-bold text-slate-800 text-xs dark:text-white">
												{dev.device_name || "Unknown Printer"}
											</Text>
											<Text className="font-mono text-[10px] text-slate-400">
												{dev.inner_mac_address}
											</Text>
										</View>

										{isConnecting ? (
											<ActivityIndicator size="small" color={themeAccent} />
										) : isConnected ? (
											<Ionicons
												name="checkmark-circle"
												size={18}
												color="#10b981"
											/>
										) : (
											<View className="rounded-md bg-slate-100 px-2 py-1 dark:bg-zinc-700">
												<Text className="font-bold text-[10px] text-slate-700 dark:text-zinc-300">
													Connect
												</Text>
											</View>
										)}
									</Pressable>
								);
							})}
						</View>
					)}
				</ScrollView>
			</HeroBottomSheet>

			{/* Store GSTIN Configuration Dialog */}
			<DialogModal
				visible={isEditStoreModalOpen}
				onClose={() => setIsEditStoreModalOpen(false)}
				title="Store GSTIN Configuration"
				subtitle="Enter your 15-digit GSTIN to print on invoices"
				footer={
					<View className="flex-row items-center justify-end gap-2">
						<Pressable
							onPress={() => setIsEditStoreModalOpen(false)}
							className="rounded-xl bg-slate-100 px-4 py-2.5 active:opacity-70 dark:bg-zinc-800"
						>
							<Text className="font-semibold text-slate-700 text-xs dark:text-zinc-300">
								Cancel
							</Text>
						</Pressable>
						<Pressable
							onPress={handleSaveStoreGstin}
							className="rounded-xl bg-slate-900 px-4 py-2.5 active:opacity-90 dark:bg-white"
						>
							<Text className="font-bold text-white text-xs dark:text-zinc-900">
								Save GSTIN
							</Text>
						</Pressable>
					</View>
				}
			>
				<View className="py-2">
					<Text className="mb-1.5 font-bold text-slate-700 text-xs dark:text-zinc-300">
						15-Digit GSTIN Number:
					</Text>
					<TextInput
						value={tempStoreGstin}
						onChangeText={(t) => setTempStoreGstin(t.toUpperCase())}
						placeholder="e.g. 08ABCDE1234F1Z5"
						placeholderTextColor="#94a3b8"
						autoCapitalize="characters"
						maxLength={15}
						className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-bold font-mono text-slate-900 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
					/>
					<Text className="mt-1 text-[10px] text-slate-400">
						Yeh GSTIN number aapke sabhi print receipts aur WhatsApp invoice
						slips par store name ke neeche print hoga.
					</Text>
				</View>
			</DialogModal>
		</Container>
	);
}
