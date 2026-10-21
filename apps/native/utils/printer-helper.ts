/**
 * MSL Thermal POS Printer Helper Utilities
 * Integrated from D:\veer custom printer architecture
 * Using @poriyaalar/react-native-thermal-receipt-printer
 *
 * NOTE: BLEPrinter.printBill on Android can call native printRawData with wrong argument count.
 * We use printText with keepConnection: true and ESC/POS command strings.
 */

import { BLEPrinter } from "@poriyaalar/react-native-thermal-receipt-printer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";

const LAST_PRINTER_KEY = "@msl_last_pos_printer";

// 2-inch (58mm) mobile thermal printers: standard 32 characters per line
export const SMALL_FONT = false;
export const LINE_WIDTH = 32;

// ESC ! 1 -> Font B (small condensed font)
const SMALL_FONT_CMD = "\x1B!\x01";

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

/** Low level print text with keepConnection */
export const printRaw = (text: string) =>
	new Promise<void>((resolve, reject) => {
		const finalText = SMALL_FONT
			? text
					.split("\n")
					.map((l) => (l.length ? SMALL_FONT_CMD + l : l))
					.join("\n")
			: text;

		BLEPrinter.printText(
			finalText,
			{
				beep: true,
				cut: true,
				tailingLine: true,
				keepConnection: true,
			} as any,
			() => resolve(),
			(err: any) => reject(err),
		);
	});

/* ----------------------------- Text Helpers ----------------------------- */

const line = (ch = "-") => ch.repeat(LINE_WIDTH);

export const leftRight = (left: string, right: string): string => {
	const maxLeft = Math.max(0, LINE_WIDTH - right.length - 1);
	const safeLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left;
	const space = Math.max(LINE_WIDTH - safeLeft.length - right.length, 1);
	return safeLeft + " ".repeat(space) + right + "\n";
};

export const formatCurrency = (amount: number): string =>
	`Rs ${amount.toLocaleString("en-IN")}`;

export const formatDate = (date: Date): string =>
	date.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});

export const formatTime = (date: Date): string =>
	date.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});

/* --------- Column helpers for 2-inch (32 chars): Item(14) Qty(5) Rate(6) Amt(7) = 32 --------- */

const C_ITEM = 14;
const C_QTY = 5;
const C_RATE = 6;
const C_AMT = 7;

const padR = (s: string, n: number) => s.slice(0, n).padEnd(n);
const padL = (s: string, n: number) => s.slice(0, n).padStart(n);

const itemRow = (name: string, qty: string, rate: string, amt: string) =>
	padR(name, C_ITEM) +
	padL(qty, C_QTY) +
	padL(rate, C_RATE) +
	padL(amt, C_AMT) +
	"\n";

/* --------------------------- Receipt Builder --------------------------- */

export const buildReceiptText = (data: ReceiptData): string => {
	let r = "";

	// ── Header ───────────────────────────────────────────────────────────────
	r += "<CB>POS GST INVOICE</CB>\n";
	r += `<CB>${data.storeName || "MSL ENTERPRISES"}</CB>\n`;
	if (data.storeAddress) r += `<C>${data.storeAddress}</C>\n`;
	if (data.gstin) r += `<C>GSTIN: ${data.gstin}</C>\n`;
	if (data.phone) r += `<C>Ph: ${data.phone}</C>\n`;
	r += `${line("=")}\n`;

	// ── Bill & Customer details ───────────────────────────────────────────────
	r += `Invoice: #${data.billNumber}\n`;
	r += `Date   : ${formatDate(data.date)} ${formatTime(data.date)}\n`;
	if (data.customerName) r += `Party  : ${data.customerName}\n`;
	if (data.customerPhone) r += `Phone  : ${data.customerPhone}\n`;
	if (data.customerGst) r += `Party GSTIN: ${data.customerGst}\n`;
	r += `${line("-")}\n`;

	// ── Items table ───────────────────────────────────────────────────────────
	r += itemRow("Item", "Qty", "Rate", "Amt");
	r += `${line("-")}\n`;

	let computedSubtotal = 0;
	data.items.forEach((item) => {
		const itemTot = item.total ?? item.quantity * item.price;
		computedSubtotal += itemTot;

		const casesText = (item.cases || 0) > 0 ? `${item.cases}cs` : "";
		const unitsText = (item.units || 0) > 0 ? `${item.units}pc` : "";
		const qtyStr =
			casesText && unitsText
				? `${casesText}+${unitsText}`
				: casesText || unitsText || `${item.quantity}`;

		if (item.name.length > C_ITEM) {
			// Long name on its own line, then data row
			r += `${item.name.slice(0, LINE_WIDTH)}\n`;
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
	r += `${line("-")}\n`;

	// ── Financial totals ─────────────────────────────────────────────────────
	// Compute Base / Taxable amounts by backing out GST from item totals (inclusive pricing)
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

	r += leftRight("Subtotal (Taxable)", totalTaxable.toFixed(2));
	if (discount > 0) {
		r += leftRight("Discount", `-${discount.toFixed(2)}`);
	}
	r += leftRight("Taxable Value", taxableValue.toFixed(2));
	r += `${line("-")}\n`;

	// ── GST Breakup (slab-wise) ───────────────────────────────────────────────
	if (gstSlabs.size > 0) {
		r += "<CB>GST Breakup</CB>\n";
		gstSlabs.forEach((entry, rate) => {
			const slabLabel = `${rate}% slab`;
			r += leftRight(
				`CGST ${entry.cgstPct}% (${slabLabel})`,
				entry.cgst.toFixed(2),
			);
			r += leftRight(
				`SGST ${entry.sgstPct}% (${slabLabel})`,
				entry.sgst.toFixed(2),
			);
		});
		r += `${line("-")}\n`;
	}

	// ── Grand Total & Round Off ───────────────────────────────────────────────
	const roundOff = Math.round(data.total) - data.total;
	const roundedTotal = Math.round(data.total);

	r += leftRight("Grand Total", data.total.toFixed(2));
	r += leftRight(
		"Round Off",
		`${roundOff > 0 ? "+" : ""}${roundOff.toFixed(2)}`,
	);
	r += `<CB>${leftRight("Rounded Total", roundedTotal.toFixed(2)).trim()}</CB>\n`;
	r += `${line("-")}\n`;

	// ── Payment Breakup (CASH, UPI, CARD, etc. + Balance Due) ──────────────────
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
			r += leftRight(`Paid (${method})`, methodTotals[method].toFixed(2));
		});
		if (methodsList.length > 1) {
			const totalPaid =
				data.paidAmount ??
				Object.values(methodTotals).reduce((a, b) => a + b, 0);
			r += leftRight("Total Paid", totalPaid.toFixed(2));
		}
	} else if (data.paidAmount !== undefined && data.paidAmount > 0) {
		r += leftRight("Paid", data.paidAmount.toFixed(2));
	} else {
		r += leftRight("Paid", "0.00");
	}

	if (data.pendingAmount && data.pendingAmount > 0) {
		r += leftRight("Balance Due", data.pendingAmount.toFixed(2));
		r +=
			data.paidAmount && data.paidAmount > 0
				? "Status: PARTIAL PAYMENT\n"
				: "Status: PAYMENT PENDING\n";
	} else {
		r += "Status: FULLY PAID\n";
	}

	if (data.note) {
		r += `${line("-")}\n`;
		r += `Note: ${data.note}\n`;
	}

	// ── Footer ────────────────────────────────────────────────────────────────
	r += `${line("=")}\n`;
	r += "<C>GST Included as applicable.</C>\n";
	r += "<C>Thank You! Visit Again!</C>\n";
	r += `${line("=")}\n\n\n\n`;

	return r;
};

/**
 * Clean up raw receipt text for on-screen monospace preview and image sharing:
 * 1. Strips all hardware command tags (<CB>, </CB>, <C>, </C>, <B>, etc.).
 * 2. Centers lines that had <C> or <CB> tags within LINE_WIDTH (32 columns).
 * 3. Keeps all column formatting and spacing perfectly intact without line wrapping.
 */
export const formatReceiptForDisplay = (rawText: string): string => {
	return rawText
		.split("\n")
		.map((rawLine) => {
			const hasCenterTag = /<\/?C[BD]?>/i.test(rawLine);
			const stripped = rawLine.replace(/<[^>]+>/g, "");
			const trimmed = stripped.trim();
			// Center header/footer/breakup titles, but never center 2-column key-value lines
			if (
				hasCenterTag &&
				trimmed.length > 0 &&
				trimmed.length < LINE_WIDTH &&
				!/\s{4,}/.test(stripped)
			) {
				const pad = Math.max(0, Math.floor((LINE_WIDTH - trimmed.length) / 2));
				return " ".repeat(pad) + trimmed;
			}
			return stripped;
		})
		.join("\n")
		.trim();
};

/* ------------------------------ Public APIs ------------------------------ */

/** Print formatted receipt */
export const printReceipt = async (data: ReceiptData) => {
	try {
		await printRaw(buildReceiptText(data));
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

	return await printReceipt(receiptData);
};

/** Print Test Page */
export const printTestPage = async () => {
	try {
		const testReceipt =
			"<CB>MSL POS TEST</CB>\n\n" +
			"58mm/80mm Thermal Printer\n" +
			"<B>Bold Header Text</B>\n" +
			"<CB>Centered Bold Text</CB>\n\n" +
			`${line("=")}\n` +
			leftRight("Left Column", "Right Column") +
			leftRight("Case Qty: 5 cs", "Rs 1,500.00") +
			`${line("=")}\n\n` +
			"<C>Printer Connection OK!</C>\n\n\n\n";

		await printRaw(testReceipt);
		return { success: true };
	} catch (error: any) {
		console.error("Test print error:", error);
		return { success: false, error: error?.message || error };
	}
};
