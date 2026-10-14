import { Ionicons } from "@expo/vector-icons";
import { useForm } from "@tanstack/react-form";
import { router } from "expo-router";
import { FieldError, useToast } from "heroui-native";
import React, { useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";
import z from "zod";

import { MslLogo } from "@/components/msl-logo";
import { authClient } from "@/lib/auth-client";

const signInSchema = z.object({
	email: z
		.string()
		.trim()
		.min(1, "Email is required")
		.email("Enter a valid email address"),
	password: z
		.string()
		.min(1, "Password is required")
		.min(8, "Use at least 8 characters"),
});

function getErrorMessage(error: unknown): string | null {
	if (!error) return null;

	if (typeof error === "string") {
		return error;
	}

	if (Array.isArray(error)) {
		for (const issue of error) {
			const message = getErrorMessage(issue);
			if (message) {
				return message;
			}
		}
		return null;
	}

	if (typeof error === "object" && error !== null) {
		const maybeError = error as { message?: unknown };
		if (typeof maybeError.message === "string") {
			return maybeError.message;
		}
	}

	return null;
}

interface SignInProps {
	onSwitchToSignUp?: () => void;
	onForgotPassword?: () => void;
}

function SignIn({ onSwitchToSignUp, onForgotPassword }: SignInProps) {
	const passwordInputRef = useRef<TextInput>(null);
	const { toast } = useToast();
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(true);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: signInSchema,
		},
		onSubmit: async ({ value, formApi }) => {
			await authClient.signIn.email(
				{
					email: value.email.trim(),
					password: value.password,
				},
				{
					onError(error) {
						toast.show({
							variant: "danger",
							label: error.error?.message || "Failed to sign in",
						});
					},
					onSuccess() {
						formApi.reset();
						toast.show({
							variant: "success",
							label: "Signed in successfully",
						});
						router.replace("/(drawer)/(tabs)" as any);
					},
				},
			);
		},
	});

	return (
		<View className="w-full">
			{/* Top MSL Logo */}
			<View className="mb-4 items-center">
				<MslLogo size="md" />
			</View>

			{/* Screen Header Titles */}
			<View className="mb-5">
				<Text className="font-extrabold text-2xl text-[#0f274a] dark:text-white">
					Login
				</Text>
				<Text className="mt-1 font-semibold text-slate-800 text-sm dark:text-slate-200">
					Welcome back!
				</Text>
				<Text className="text-slate-500 text-xs dark:text-slate-400">
					Please login to your account.
				</Text>
			</View>

			<form.Subscribe
				selector={(state) => ({
					isSubmitting: state.isSubmitting,
					validationError: getErrorMessage(state.errorMap.onSubmit),
				})}
			>
				{({ isSubmitting, validationError }) => {
					const formError = validationError;

					return (
						<View className="gap-4">
							{/* Form Level Error Message */}
							{formError ? (
								<FieldError isInvalid={!!formError} className="mb-1">
									{formError}
								</FieldError>
							) : null}

							{/* Email Input Field */}
							<form.Field name="email">
								{(field) => (
									<View>
										<Text className="mb-1.5 font-medium text-slate-700 text-xs dark:text-slate-300">
											Email / Mobile Number
										</Text>
										<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
											<Ionicons
												name="mail-outline"
												size={18}
												color="#94a3b8"
												style={{ marginRight: 8 }}
											/>
											<TextInput
												value={field.state.value}
												onBlur={field.handleBlur}
												onChangeText={field.handleChange}
												placeholder="Enter email address"
												placeholderTextColor="#94a3b8"
												keyboardType="email-address"
												autoCapitalize="none"
												autoComplete="email"
												textContentType="emailAddress"
												returnKeyType="next"
												blurOnSubmit={false}
												onSubmitEditing={() => {
													passwordInputRef.current?.focus();
												}}
												className="flex-1 text-slate-900 text-sm dark:text-white"
												style={{ paddingVertical: 0 }}
											/>
										</View>
										{field.state.meta.errors?.[0] ? (
											<Text className="mt-1 text-red-500 text-xs">
												{field.state.meta.errors[0]?.toString()}
											</Text>
										) : null}
									</View>
								)}
							</form.Field>

							{/* Password Input Field */}
							<form.Field name="password">
								{(field) => (
									<View>
										<Text className="mb-1.5 font-medium text-slate-700 text-xs dark:text-slate-300">
											Password
										</Text>
										<View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
											<Ionicons
												name="lock-closed-outline"
												size={18}
												color="#94a3b8"
												style={{ marginRight: 8 }}
											/>
											<TextInput
												ref={passwordInputRef}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChangeText={field.handleChange}
												placeholder="Enter password"
												placeholderTextColor="#94a3b8"
												secureTextEntry={!showPassword}
												autoComplete="password"
												textContentType="password"
												returnKeyType="go"
												onSubmitEditing={form.handleSubmit}
												className="flex-1 text-slate-900 text-sm dark:text-white"
												style={{ paddingVertical: 0 }}
											/>
											<Pressable
												onPress={() => setShowPassword(!showPassword)}
												hitSlop={8}
											>
												<Ionicons
													name={
														showPassword ? "eye-off-outline" : "eye-outline"
													}
													size={20}
													color="#94a3b8"
												/>
											</Pressable>
										</View>
										{field.state.meta.errors?.[0] ? (
											<Text className="mt-1 text-red-500 text-xs">
												{field.state.meta.errors[0]?.toString()}
											</Text>
										) : null}
									</View>
								)}
							</form.Field>

							{/* Remember Me & Forgot Password Row */}
							<View className="flex-row items-center justify-between pt-0.5">
								<Pressable
									onPress={() => setRememberMe(!rememberMe)}
									className="flex-row items-center"
									hitSlop={8}
								>
									<Ionicons
										name={rememberMe ? "checkbox" : "square-outline"}
										size={18}
										color={rememberMe ? "#0f274a" : "#94a3b8"}
										style={{ marginRight: 6 }}
									/>
									<Text className="text-slate-600 text-xs dark:text-slate-300">
										Remember me
									</Text>
								</Pressable>

								<Pressable
									onPress={() => {
										if (onForgotPassword) {
											onForgotPassword();
										} else {
											toast.show({
												label: "Contact administrator to reset your password",
											});
										}
									}}
									hitSlop={8}
								>
									<Text className="font-semibold text-[#0f274a] text-xs dark:text-sky-400">
										Forgot password?
									</Text>
								</Pressable>
							</View>

							{/* Primary Golden Login Button */}
							<Pressable
								onPress={form.handleSubmit}
								disabled={isSubmitting}
								className="mt-2 items-center justify-center rounded-xl bg-[#f59e0b] py-3.5 shadow-sm active:opacity-90"
							>
								{isSubmitting ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Text className="font-bold text-base text-white">Login</Text>
								)}
							</Pressable>

							{/* OR Divider */}
							<View className="my-1 flex-row items-center gap-3">
								<View className="h-[1px] flex-1 bg-slate-200 dark:bg-zinc-800" />
								<Text className="font-medium text-slate-400 text-xs">OR</Text>
								<View className="h-[1px] flex-1 bg-slate-200 dark:bg-zinc-800" />
							</View>

							{/* Secondary Outlined Action Button */}
							<Pressable
								onPress={() => {
									toast.show({
										label:
											"OTP verification is enabled for registered mobile users",
									});
								}}
								className="items-center justify-center rounded-xl border border-slate-300 bg-white py-3 active:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900"
							>
								<Text className="font-semibold text-slate-700 text-sm dark:text-slate-200">
									Login with OTP
								</Text>
							</Pressable>

							{/* Register Switch Link */}
							<View className="mt-2 flex-row items-center justify-center">
								<Text className="text-slate-500 text-xs dark:text-slate-400">
									Don't have an account?{" "}
								</Text>
								<Pressable onPress={onSwitchToSignUp} hitSlop={8}>
									<Text className="font-bold text-[#f59e0b] text-xs">
										Register
									</Text>
								</Pressable>
							</View>
						</View>
					);
				}}
			</form.Subscribe>
		</View>
	);
}

export { SignIn };
