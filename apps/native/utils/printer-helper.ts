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

// SMALL_FONT = true -> Font B (small). Perfect for 58mm mobile thermal printers.
export const SMALL_FONT = true;

// 58mm paper: normal 32 chars, small font 42 chars
// 80mm paper: normal 48 chars, small font 64 chars
export const LINE_WIDTH = SMALL_FONT ? 42 : 32;

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
	const space = Math.max(LINE_WIDTH - left.length - right.length, 1);
	return left + " ".repeat(space) + right + "\n";
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

/* --------- Column helpers: Item(18) Qty(5) Rate(8) Amt(8) = 39+3 = 42 --------- */

const C_ITEM = 18;
const C_QTY = 5;
const C_RATE = 8;
const C_AMT = 8;

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
	r += `<C>${line("=")}</C>\n`;

	// ── Bill & Customer details ───────────────────────────────────────────────
	r += `Invoice: #${data.billNumber}\n`;
	r += `Date   : ${formatDate(data.date)} ${formatTime(data.date)}\n`;
	if (data.customerName) r += `Party  : ${data.customerName}\n`;
	if (data.customerPhone) r += `Phone  : ${data.customerPhone}\n`;
	if (data.customerGst) r += `GSTIN  : ${data.customerGst}\n`;
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
	const subtotal = data.subtotal || computedSubtotal;
	const discount = data.discount || 0;
	const taxableValue = subtotal - discount;

	r += leftRight("Subtotal:", `Rs ${subtotal.toFixed(2)}`);
	if (discount > 0) {
		r += leftRight("Discount:", `-Rs ${discount.toFixed(2)}`);
	}
	r += leftRight("Taxable Value:", `Rs ${taxableValue.toFixed(2)}`);
	r += `${line("-")}\n`;

	// ── GST Breakup (slab-wise) ───────────────────────────────────────────────
	// Group items by gstRate and compute CGST + SGST per slab
	type GstSlabEntry = {
		taxable: number;
		cgst: number;
		sgst: number;
		cgstPct: number;
		sgstPct: number;
	};
	const gstSlabs = new Map<number, GstSlabEntry>();

	data.items.forEach((item) => {
		const rate = item.gstRate ?? 0;
		if (rate <= 0) return;
		const itemTot = item.total ?? item.quantity * item.price;
		const cgstPct = item.cgst ?? rate / 2;
		const sgstPct = item.sgst ?? rate / 2;
		const gstAmt = (itemTot * rate) / 100;
		const entry = gstSlabs.get(rate) ?? {
			taxable: 0,
			cgst: 0,
			sgst: 0,
			cgstPct,
			sgstPct,
		};
		entry.taxable += itemTot;
		entry.cgst += gstAmt / 2;
		entry.sgst += gstAmt / 2;
		gstSlabs.set(rate, entry);
	});

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

	r += leftRight("Grand Total:", `Rs ${data.total.toFixed(2)}`);
	if (Math.abs(roundOff) > 0.001) {
		r += leftRight(
			"Round Off:",
			`${roundOff > 0 ? "+" : ""}${roundOff.toFixed(2)}`,
		);
	}
	r += `<CB>${leftRight("Rounded Total:", `Rs ${roundedTotal}`).trim()}</CB>\n`;
	r += `${line("-")}\n`;

	// ── Payment ───────────────────────────────────────────────────────────────
	if (data.paidAmount !== undefined) {
		r += leftRight("Paid:", `Rs ${data.paidAmount.toFixed(2)}`);
	}
	if (data.pendingAmount && data.pendingAmount > 0) {
		r += leftRight("Balance Due:", `Rs ${data.pendingAmount.toFixed(2)}`);
		r += "Status: PAYMENT PENDING\n";
	} else {
		r += "Status: FULLY PAID\n";
	}

	if (data.note) {
		r += `${line("-")}\n`;
		r += `Note: ${data.note}\n`;
	}

	// ── Footer ────────────────────────────────────────────────────────────────
	r += `<C>${line("=")}</C>\n`;
	r += "<C>GST Included as applicable.</C>\n";
	r += "<C>Thank You! Visit Again!</C>\n";
	r += `<C>${line("=")}</C>\n\n\n\n`;

	return r;
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
	options?: { storeName?: string; phone?: string },
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
		phone: options?.phone || "Jaipur, Rajasthan",
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
