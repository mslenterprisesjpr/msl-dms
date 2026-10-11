import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";

interface UploadSignature {
	signature: string;
	timestamp: number;
	cloudName: string;
	apiKey: string;
	folder?: string;
}

export function useImageUpload() {
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);

	const pickImage = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
		// Request permission
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			alert("Sorry, we need camera roll permissions to upload images!");
			return null;
		}

		// Pick image
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1], // Square aspect ratio for product images
			quality: 0.8,
		});

		if (!result.canceled && result.assets[0]) {
			return result.assets[0];
		}

		return null;
	};

	const takePhoto = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
		// Request permission
		const { status } = await ImagePicker.requestCameraPermissionsAsync();
		if (status !== "granted") {
			alert("Sorry, we need camera permissions to take photos!");
			return null;
		}

		// Take photo
		const result = await ImagePicker.launchCameraAsync({
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.8,
		});

		if (!result.canceled && result.assets[0]) {
			return result.assets[0];
		}

		return null;
	};

	const uploadToCloudinary = async (
		imageUri: string,
	): Promise<string | null> => {
		try {
			setUploading(true);
			setProgress(0);

			console.log("📤 Starting upload for:", imageUri);

			// Get upload signature from backend
			const { data: signatureData } = await apiClient.get<UploadSignature>(
				"/cloudinary/signature",
				{
					params: { folder: "products" },
				},
			);

			console.log("✅ Signature received from backend");
			setProgress(20);

			// Prepare upload URL
			const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;

			console.log("☁️ Uploading to Cloudinary using FileSystem...");

			// Use expo-file-system/legacy for upload (React Native compatible)
			const uploadResult = await FileSystem.uploadAsync(uploadUrl, imageUri, {
				httpMethod: "POST",
				uploadType: FileSystem.FileSystemUploadType.MULTIPART,
				fieldName: "file",
				parameters: {
					api_key: signatureData.apiKey,
					timestamp: String(signatureData.timestamp),
					signature: signatureData.signature,
					...(signatureData.folder && { folder: signatureData.folder }),
				},
			});

			console.log("📡 Response status:", uploadResult.status);

			setProgress(80);

			if (uploadResult.status !== 200) {
				console.error("❌ Cloudinary upload failed:", uploadResult.body);
				throw new Error(`Upload failed: ${uploadResult.status}`);
			}

			const data = JSON.parse(uploadResult.body);
			setProgress(100);

			console.log("✅ Upload complete:", data.secure_url);
			return data.secure_url;
		} catch (error: any) {
			console.error("❌ Image upload error:", error);
			return null;
		} finally {
			setUploading(false);
			setProgress(0);
		}
	};

	return {
		pickImage,
		takePhoto,
		uploadToCloudinary,
		uploading,
		progress,
	};
}
