/**
 * MSL Thermal POS Printer Helper Utilities
 * Using @poriyaalar/react-native-thermal-receipt-printer
 *
 * NOTE: BLEPrinter.printBill on Android can call native printRawData with wrong argument count.
 * We send raw ESC/POS bytes via NativeModules.RNBLEPrinter.printRawData instead.
 */

import { BLEPrinter } from "@poriyaalar/react-native-thermal-receipt-printer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";

const LAST_PRINTER_KEY = "@msl_last_pos_printer";

// Legacy default (Font A, 32 cols). Use getLayout() for mode-aware widths.
export const LINE_WIDTH = 32;

export type PrintFontSize = "large" | "medium" | "small";
export const LAST_FONT_SIZE_KEY = "@msl_print_font_size";

/**
 * Print head = 384 dots.
 * Font A (12 dots) -> 32 cols  (32*12 = 384)
 * Font B (9 dots)  -> 42 cols  (42*9  = 378)
 * Some 58mm heads print only ~372 dots; if Font B wraps, change 42 -> 41.
 */
export const getLayout = (size: PrintFontSize = "large") =>
	size === "large"
		? { cols: 32, item: 14, qty: 5, rate: 6, amt: 7 }
		: { cols: 42, item: 20, qty: 6, rate: 7, amt: 9 };

// Monospace glyph width ~0.6em, + px-3 padding (24) + border (2)
const previewWidthFor = (cols: number, fontSize: number) =>
	Math.ceil(cols * fontSize * 0.6) + 24 + 2;

// ESC/POS Font commands
// Large : Font A (12x24) + default line spacing
// Medium: Font B (9x17)  + 22-dot spacing
// Small : Font B (9x17)  + 16-dot spacing
export const getFontConfig = (size: PrintFontSize = "large") => {
	const { cols } = getLayout(size);
	switch (size) {
		case "small":
			return {
				cols,
				fontCmd: "\x1B!\x01",
				lineSpaceCmd: "\x1B3\x10",
				previewWidth: previewWidthFor(cols, 11),
				previewFontSize: 11,
				previewLineHeight: 15,
			};
		case "medium":
			return {
				cols,
				fontCmd: "\x1B!\x01",
				lineSpaceCmd: "\x1B3\x16",
				previewWidth: previewWidthFor(cols, 12),
				previewFontSize: 12,
				previewLineHeight: 16,
			};
		case "large":
		default:
			return {
				cols,
				fontCmd: "\x1B!\x00",
				lineSpaceCmd: "\x1B2",
				previewWidth: previewWidthFor(cols, 13),
				previewFontSize: 13,
				previewLineHeight: 18,
			};
	}
};

export async function getSavedFontSize(): Promise<PrintFontSize> {
	try {
		const saved = await AsyncStorage.getItem(LAST_FONT_SIZE_KEY);
		if (saved === "large" || saved === "medium" || saved === "small") {
			return saved;
		}
	} catch (e) {
		console.log("Error reading font size:", e);
	}
	return "large";
}

export async function saveFontSize(size: PrintFontSize): Promise<void> {
	try {
		await AsyncStorage.setItem(LAST_FONT_SIZE_KEY, size);
	} catch (e) {
		console.log("Error saving font size:", e);
	}
}

export interface PrinterDevice {
	device_name?: string;
	inner_mac_address: string;
}

export interface ReceiptItem {
	name: string;
	cases?: number;
	units?: number;
	quantity: number;
	unit?: string;
	price: number;
	total?: number;
	gstRate?: number;
	cgst?: number;
	sgst?: number;
}

export interface ReceiptData {
	storeName?: string;
	storeAddress?: string;
	phone?: string;
	gstin?: string;
	billNumber: string;
	date: Date;
	customerName?: string;
	customerPhone?: string;
	customerGst?: string;
	items: ReceiptItem[];
	subtotal: number;
	discount?: number;
	total: number;
	paidAmount?: number;
	pendingAmount?: number;
	paymentStatus?: string;
	payments?: Array<{
		amount: number;
		paymentMethod: string;
		paymentDate?: string;
	}>;
	note?: string;
}

/** Ask Android Bluetooth & Location Permissions */
export async function askBluetoothPermissions(): Promise<boolean> {
	if (Platform.OS !== "android") return true;

	try {
		if (Platform.Version >= 31) {
			const res = await PermissionsAndroid.requestMultiple([
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
			]);
			return (
				res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
					PermissionsAndroid.RESULTS.GRANTED &&
				res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
					PermissionsAndroid.RESULTS.GRANTED
			);
		}

		const res = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
		);
		return res === PermissionsAndroid.RESULTS.GRANTED;
	} catch (e) {
		console.error("Bluetooth permission error:", e);
		return false;
	}
}

/** Scan for Bluetooth Printers */
export async function scanBluetoothPrinters(): Promise<PrinterDevice[]> {
	const hasPerm = await askBluetoothPermissions();
	if (!hasPerm) {
		throw new Error(
			"Bluetooth permission is required. Please allow Bluetooth in Phone Settings.",
		);
	}

	await BLEPrinter.init();
	const list = await BLEPrinter.getDeviceList();
	return list || [];
}

/** Connect to specific printer by MAC address */
export async function connectToPrinter(
	device: PrinterDevice,
): Promise<boolean> {
	await BLEPrinter.init();
	await BLEPrinter.connectPrinter(device.inner_mac_address);
	await AsyncStorage.setItem(LAST_PRINTER_KEY, JSON.stringify(device));
	return true;
}

/** Disconnect printer */
export async function disconnectPrinter(): Promise<void> {
	try {
		if (BLEPrinter.closeConn) {
			await BLEPrinter.closeConn();
		}
	} catch (e) {
		console.log("Disconnect error:", e);
	}
	await AsyncStorage.removeItem(LAST_PRINTER_KEY);
}

/** Get cached paired printer */
export async function getSavedPrinter(): Promise<PrinterDevice | null> {
	try {
		const json = await AsyncStorage.getItem(LAST_PRINTER_KEY);
		if (json) return JSON.parse(json);
	} catch (e) {
		console.log("Error reading saved printer:", e);
	}
	return null;
}

/** Convert Uint8Array to Base64 in React Native */
function uint8ToBase64(bytes: Uint8Array): string {
	let binary = "";
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	if (typeof btoa === "function") {
		return btoa(binary);
	}
	try {
		const { Buffer } = require("buffer");
		return Buffer.from(bytes).toString("base64");
	} catch {
		return "";
	}
}

/**
 * Encode receipt text directly to binary ESC/POS byte commands:
 * - ESC @ : Reset printer
 * - ESC t 0 : CP437
 * - ESC 2 / ESC 3 n : Line spacing
 * - ESC M 0/1 + ESC ! 0/1 : Font A vs Font B
 * - ESC a 1 / ESC a 0 : Center vs Left
 * Bypasses library middleware so font/spacing commands are not stripped.
 */
export const encodeReceiptToEscPos = (
	rawText: string,
	fontSize: PrintFontSize = "large",
): string => {
	const bytes: number[] = [];

	// 1. Reset printer
	bytes.push(0x1b, 0x40);

	// 2. Code table CP437
	bytes.push(0x1b, 0x74, 0x00);

	// 3. Line spacing
	if (fontSize === "small") {
		bytes.push(0x1b, 0x33, 16);
	} else if (fontSize === "medium") {
		bytes.push(0x1b, 0x33, 22);
	} else {
		bytes.push(0x1b, 0x32);
	}

	// 4. Font
	const setFontCmds = () => {
		if (fontSize === "small" || fontSize === "medium") {
			bytes.push(0x1b, 0x4d, 0x01); // ESC M 1 (Font B)
			bytes.push(0x1b, 0x21, 0x01); // ESC ! 1
		} else {
			bytes.push(0x1b, 0x4d, 0x00); // ESC M 0 (Font A)
			bytes.push(0x1b, 0x21, 0x00); // ESC ! 0
		}
	};
	setFontCmds();

	// 5. Lines (trailing newlines stripped so no extra blank feed)
	const lines = rawText.replace(/\n+$/, "").split("\n");
	for (let i = 0; i < lines.length; i++) {
		const ln = lines[i];
		const isCentered = /<\/?C[BD]?>/i.test(ln);
		const cleanLine = ln.replace(/<[^>]+>/g, "");

		if (isCentered) {
			bytes.push(0x1b, 0x61, 0x01); // center
		}

		for (let j = 0; j < cleanLine.length; j++) {
			const code = cleanLine.charCodeAt(j);
			bytes.push(code > 127 ? 0x20 : code);
		}

		bytes.push(0x0a);

		if (isCentered) {
			bytes.push(0x1b, 0x61, 0x00); // left
		}

		setFontCmds();
	}

	// 6. Tear-off margin: exactly 2 feeds, then restore default spacing
	bytes.push(0x0a, 0x0a);
	bytes.push(0x1b, 0x32);

	return uint8ToBase64(new Uint8Array(bytes));
};

/** Low level print with raw ESC/POS bytes */
export const printRaw = (text: string, fontSize: PrintFontSize = "large") =>
	new Promise<void>((resolve, reject) => {
		try {
			const base64Data = encodeReceiptToEscPos(text, fontSize);
			const { RNBLEPrinter } = NativeModules;
			if (RNBLEPrinter && typeof RNBLEPrinter.printRawData === "function") {
				RNBLEPrinter.printRawData(
					base64Data,
					true,
					() => resolve(),
					(err: any) => reject(err),
				);
			} else {
				BLEPrinter.printText(
					text,
					{
						beep: false,
						cut: false,
						tailingLine: false,
						keepConnection: true,
					} as any,
					() => resolve(),
					(err: any) => reject(err),
				);
			}
		} catch (e) {
			reject(e);
		}
	});

/* ----------------------------- Text Helpers ----------------------------- */

const line = (ch = "-", cols = LINE_WIDTH) => ch.repeat(cols);

export const leftRight = (
	left: string,
	right: string,
	cols = LINE_WIDTH,
): string => {
	const maxLeft = Math.max(0, cols - right.length - 1);
	const safeLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left;
	const space = Math.max(cols - safeLeft.length - right.length, 1);
	return safeLeft + " ".repeat(space) + right + "\n";
};

export const formatCurrency = (amount: number): string =>
	`Rs ${amount.toLocaleString("en-IN")}`;

export const formatDate = (date: Date): string => {
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const d = date.getDate().toString().padStart(2, "0");
	const m = months[date.getMonth()];
	const y = date.getFullYear();
	return `${d} ${m} ${y}`;
};

export const formatTime = (date: Date): string => {
	let h = date.getHours();
	const m = date.getMinutes().toString().padStart(2, "0");
	const ampm = h >= 12 ? "pm" : "am";
	h = h % 12 || 12;
	return `${h.toString().padStart(2, "0")}:${m} ${ampm}`;
};

const padR = (s: string, n: number) => s.slice(0, n).padEnd(n);
const padL = (s: string, n: number) => s.slice(0, n).padStart(n);

/* --------------------------- Receipt Builder --------------------------- */

export const buildReceiptText = (
	data: ReceiptData,
	fontSize: PrintFontSize = "large",
): string => {
	const L = getLayout(fontSize);
	const ln = (ch = "-") => line(ch, L.cols);
	const lr = (a: string, b: string) => leftRight(a, b, L.cols);
	const itemRow = (name: string, qty: string, rate: string, amt: string) =>
		padR(name, L.item) +
		padL(qty, L.qty) +
		padL(rate, L.rate) +
		padL(amt, L.amt) +
		"\n";

	let r = "";

	// ── Header ───────────────────────────────────────────────────────────────
	r += "<C>GST INVOICE</C>\n";
	r += `<C>${data.storeName || "MSL ENTERPRISES"}</C>\n`;
	if (data.storeAddress) r += `<C>${data.storeAddress}</C>\n`;
	if (data.gstin && data.gstin.trim().length > 0) {
		r += `<C>GSTIN: ${data.gstin.trim()}</C>\n`;
	}
	if (data.phone) r += `<C>Ph: ${data.phone}</C>\n`;
	r += `${ln("=")}\n`;

	// ── Bill & Customer details ───────────────────────────────────────────────
	r += `Invoice: #${data.billNumber}\n`;
	r += `Date   : ${formatDate(data.date)} ${formatTime(data.date)}\n`;
	if (data.customerName) r += `Party  : ${data.customerName}\n`;
	if (data.customerPhone) r += `Phone  : ${data.customerPhone}\n`;
	if (data.customerGst && data.customerGst.trim().length > 0) {
		r += `Party GSTIN: ${data.customerGst.trim()}\n`;
	} else {
		r += "Party GSTIN: Unregistered\n";
	}
	r += `${ln("-")}\n`;

	// ── Items table ───────────────────────────────────────────────────────────
	r += itemRow("Item", "Qty", "Rate", "Amt");
	r += `${ln("-")}\n`;

	data.items.forEach((item) => {
		const itemTot = item.total ?? item.quantity * item.price;

		const casesText = (item.cases || 0) > 0 ? `${item.cases}cs` : "";
		const unitsText = (item.units || 0) > 0 ? `${item.units}pc` : "";
		const qtyStr =
			casesText && unitsText
				? `${casesText}+${unitsText}`
				: casesText || unitsText || `${item.quantity}`;

		if (item.name.length > L.item) {
			r += `${item.name.slice(0, L.cols)}\n`;
			r += itemRow("", qtyStr, item.price.toFixed(0), itemTot.toFixed(0));
		} else {
			r += itemRow(
				item.name,
				qtyStr,
				item.price.toFixed(0),
				itemTot.toFixed(0),
			);
		}
	});
	r += `${ln("-")}\n`;

	// ── Financial totals (GST backed out of inclusive prices) ────────────────
	let totalTaxable = 0;
	type GstSlabEntry = {
		taxable: number;
		cgst: number;
		sgst: number;
		cgstPct: number;
		sgstPct: number;
	};
	const gstSlabs = new Map<number, GstSlabEntry>();

	data.items.forEach((item) => {
		const itemGross = item.total ?? item.quantity * item.price;
		const rate = item.gstRate ?? 0;

		let itemTaxable = itemGross;
		let itemGst = 0;
		if (rate > 0) {
			itemTaxable = itemGross / (1 + rate / 100);
			itemGst = itemGross - itemTaxable;
		}
		totalTaxable += itemTaxable;

		if (rate > 0) {
			const cgstPct = item.cgst ?? rate / 2;
			const sgstPct = item.sgst ?? rate / 2;
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

	const discount = data.discount || 0;
	const taxableValue = Math.max(0, totalTaxable - discount);

	if (discount > 0) {
		r += lr("Subtotal", totalTaxable.toFixed(2));
		r += lr("Discount", `-${discount.toFixed(2)}`);
		r += lr("Taxable Value", taxableValue.toFixed(2));
	} else {
		r += lr("Taxable Value", taxableValue.toFixed(2));
	}
	r += `${ln("-")}\n`;

	// ── GST Breakup (slab-wise, left aligned) ────────────────────────────────
	if (gstSlabs.size > 0) {
		r += "GST Breakup\n";
		gstSlabs.forEach((entry, rate) => {
			const slabLabel = `${rate}% slab`;
			r += lr(`CGST ${entry.cgstPct}% (${slabLabel})`, entry.cgst.toFixed(2));
			r += lr(`SGST ${entry.sgstPct}% (${slabLabel})`, entry.sgst.toFixed(2));
		});
		r += `${ln("-")}\n`;
	}

	// ── Total & Round Off ────────────────────────────────────────────────────
	const roundOff = Math.round(data.total) - data.total;
	const roundedTotal = Math.round(data.total);

	if (Math.abs(roundOff) >= 0.01) {
		r += lr("Total", data.total.toFixed(2));
		r += lr("Round Off", `${roundOff > 0 ? "+" : ""}${roundOff.toFixed(2)}`);
		r += lr("Rounded Total", roundedTotal.toFixed(2));
	} else {
		r += lr("Total Amount", roundedTotal.toFixed(2));
	}
	r += `${ln("-")}\n`;

	// ── Payment Breakup ──────────────────────────────────────────────────────
	const methodTotals: Record<string, number> = {};
	if (data.payments && data.payments.length > 0) {
		data.payments.forEach((p) => {
			const m = (p.paymentMethod || "CASH").toUpperCase();
			methodTotals[m] = (methodTotals[m] || 0) + (p.amount || 0);
		});
	}

	const methodsList = Object.keys(methodTotals);
	if (methodsList.length > 0) {
		methodsList.forEach((method) => {
			r += lr(`Paid (${method})`, methodTotals[method].toFixed(2));
		});
		if (methodsList.length > 1) {
			const totalPaid =
				data.paidAmount ??
				Object.values(methodTotals).reduce((a, b) => a + b, 0);
			r += lr("Total Paid", totalPaid.toFixed(2));
		}
	} else if (data.paidAmount !== undefined && data.paidAmount > 0) {
		r += lr("Paid", data.paidAmount.toFixed(2));
	} else {
		r += lr("Paid", "0.00");
	}

	if (data.pendingAmount && data.pendingAmount > 0) {
		r += lr("Balance Due", data.pendingAmount.toFixed(2));
		r +=
			data.paidAmount && data.paidAmount > 0
				? "Status: PARTIAL PAYMENT\n"
				: "Status: PAYMENT PENDING\n";
	} else {
		r += "Status: FULLY PAID\n";
	}

	if (data.note) {
		r += `${ln("-")}\n`;
		r += `Note: ${data.note}\n`;
	}

	// ── Footer (no trailing blank lines; encoder adds the 2 tear feeds) ──────
	r += `${ln("=")}\n`;
	r += "<C>Thank You! Visit Again!</C>\n";
	r += `${ln("=")}\n`;

	return r;
};

/**
 * Clean raw receipt text for on-screen preview / image sharing:
 * strips tags and centers tagged lines within the active column width.
 */
export const formatReceiptForDisplay = (
	rawText: string,
	fontSize: PrintFontSize = "large",
): string => {
	const cols = getLayout(fontSize).cols;
	return rawText
		.split("\n")
		.map((rawLine) => {
			const hasCenterTag = /<\/?C[BD]?>/i.test(rawLine);
			const stripped = rawLine.replace(/<[^>]+>/g, "");
			const trimmed = stripped.trim();
			if (
				hasCenterTag &&
				trimmed.length > 0 &&
				trimmed.length < cols &&
				!/\s{4,}/.test(stripped)
			) {
				const pad = Math.max(0, Math.floor((cols - trimmed.length) / 2));
				return " ".repeat(pad) + trimmed;
			}
			return stripped;
		})
		.join("\n")
		.trim();
};

/* ------------------------------ Public APIs ------------------------------ */

/** Print formatted receipt */
export const printReceipt = async (
	data: ReceiptData,
	fontSize: PrintFontSize = "large",
) => {
	try {
		await printRaw(buildReceiptText(data, fontSize), fontSize);
		return { success: true };
	} catch (error: any) {
		console.error("Print receipt error:", error);
		return { success: false, error: error?.message || error };
	}
};

/** Print Sale object from backend */
export const printSaleInvoice = async (
	sale: any,
	options?: {
		storeName?: string;
		phone?: string;
		gstin?: string;
		address?: string;
		fontSize?: PrintFontSize;
	},
) => {
	const customer = typeof sale.customerId === "object" ? sale.customerId : null;
	const customerName = customer?.name || "Counter Customer";
	const customerPhone = customer?.phone || "";
	const customerGst = customer?.gstNumber || "";

	const items: ReceiptItem[] = (sale.items || []).map((i: any) => {
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
	});

	const receiptData: ReceiptData = {
		storeName: options?.storeName || "MSL ENTERPRISES",
		storeAddress: options?.address || "Jaipur, Rajasthan",
		phone: options?.phone || "",
		gstin: options?.gstin || "",
		billNumber: sale.invoiceNo || sale._id.slice(-6).toUpperCase(),
		date: new Date(sale.saleDate || sale.createdAt || new Date()),
		customerName,
		customerPhone,
		customerGst,
		items,
		subtotal: sale.subtotal || sale.total,
		discount: sale.discount || 0,
		total: sale.total,
		paidAmount: sale.paidAmount,
		pendingAmount: sale.pendingAmount,
		paymentStatus: sale.paymentStatus,
		payments: sale.payments || [],
		note: sale.note,
	};

	return await printReceipt(receiptData, options?.fontSize || "large");
};

/** Print Test Page */
export const printTestPage = async () => {
	try {
		const testReceipt =
			"<CB>MSL POS TEST</CB>\n\n" +
			"58mm Thermal Printer\n" +
			"<B>Bold Header Text</B>\n" +
			"<CB>Centered Bold Text</CB>\n\n" +
			`${line("=")}\n` +
			leftRight("Left Column", "Right Column") +
			leftRight("Case Qty: 5 cs", "Rs 1,500.00") +
			`${line("=")}\n\n` +
			"<C>Printer Connection OK!</C>";

		await printRaw(testReceipt);
		return { success: true };
	} catch (error: any) {
		console.error("Test print error:", error);
		return { success: false, error: error?.message || error };
	}
};
