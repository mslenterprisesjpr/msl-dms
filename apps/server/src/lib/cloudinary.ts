import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Generate upload signature for client-side uploads
 * @param folder - Optional folder path in Cloudinary
 * @returns Object containing signature, timestamp, and other upload parameters
 */
export function generateUploadSignature(folder?: string) {
	const timestamp = Math.round(Date.now() / 1000);
	const params: Record<string, string | number> = {
		timestamp,
	};

	if (folder) {
		params.folder = folder;
	}

	const signature = cloudinary.utils.api_sign_request(
		params,
		process.env.CLOUDINARY_API_SECRET || "",
	);

	return {
		signature,
		timestamp,
		cloudName: process.env.CLOUDINARY_CLOUD_NAME, //optinal
		apiKey: process.env.CLOUDINARY_API_KEY,
		...(folder && { folder }),
	};
}

/**
 * Generate a signed URL for an existing Cloudinary asset
 * @param publicId - The public ID of the asset
 * @param transformations - Optional transformation options
 * @returns Signed URL
 */
export function generateSignedUrl(
	publicId: string,
	transformations?: Record<string, unknown>,
) {
	return cloudinary.url(publicId, {
		sign_url: true,
		type: "authenticated",
		...transformations,
	});
}

export default cloudinary;
