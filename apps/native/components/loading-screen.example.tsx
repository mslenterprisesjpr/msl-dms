/**
 * LoadingScreen Component Usage Examples
 *
 * This file demonstrates different ways to use the LoadingScreen component
 * across your application for consistent loading states.
 */

import { LoadingScreen } from "./loading-screen";

// ============================================
// EXAMPLE 1: Basic Loading (Default)
// ============================================
function Example1() {
	if (isLoading) {
		return <LoadingScreen />;
		// Shows: "Loading..." with spinner
	}
}

// ============================================
// EXAMPLE 2: Custom Message
// ============================================
function Example2() {
	if (isLoading) {
		return <LoadingScreen message="Loading products..." />;
	}
}

// ============================================
// EXAMPLE 3: With Subtitle
// ============================================
function Example3() {
	if (isLoading) {
		return (
			<LoadingScreen
				message="Loading product details..."
				subtitle="Please wait while we fetch the product information"
			/>
		);
	}
}

// ============================================
// EXAMPLE 4: Different Spinner Sizes
// ============================================
function Example4() {
	if (isLoading) {
		return (
			<LoadingScreen
				message="Quick load..."
				size="sm" // Options: "sm", "md", "lg" (default)
			/>
		);
	}
}

// ============================================
// EXAMPLE 5: Real-world Product Screen
// ============================================
function ProductsScreen() {
	const { data, isLoading, error } = useProducts();

	if (isLoading) {
		return (
			<LoadingScreen
				message="Loading products..."
				subtitle="Fetching your inventory"
			/>
		);
	}

	if (error) {
		return <ErrorScreen error={error} />;
	}

	return <ProductList products={data} />;
}

// ============================================
// EXAMPLE 6: Customer Details Screen
// ============================================
function CustomerDetailsScreen() {
	const { id } = useParams();
	const { data, isLoading } = useCustomer(id);

	if (isLoading) {
		return <LoadingScreen message="Loading customer details..." />;
	}

	return <CustomerForm customer={data} />;
}

// ============================================
// EXAMPLE 7: Stock History
// ============================================
function StockHistoryScreen() {
	const { data, isLoading } = useStockTransactions();

	if (isLoading) {
		return (
			<LoadingScreen
				message="Loading stock history..."
				subtitle="Fetching all stock transactions"
				size="lg"
			/>
		);
	}

	return <StockHistoryList data={data} />;
}

// ============================================
// PROPS REFERENCE
// ============================================
/**
 * LoadingScreen Props:
 *
 * @param message - Main loading message (default: "Loading...")
 * @param subtitle - Optional subtitle text below the message
 * @param size - Spinner size: "sm" | "md" | "lg" (default: "lg")
 *
 * Features:
 * ✅ Dark/Light mode support (automatic via useColorScheme)
 * ✅ Safe area support (handles notch/status bar)
 * ✅ Centered content (vertical + horizontal)
 * ✅ HeroUI Native Spinner (built-in smooth animation)
 * ✅ Responsive text sizing
 * ✅ Accessible typography
 */
