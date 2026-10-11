import { Hono } from "hono";
import { generateUploadSignature } from "../lib/cloudinary";
import { requireAuth } from "../middleware/authentication.middleware";

const cloudinaryRoutes = new Hono();

// Get upload signature - requires authentication
cloudinaryRoutes.get("/signature", requireAuth, async (c) => {
	try {
		const { folder } = c.req.query();

		const signature = generateUploadSignature(folder);

		return c.json(signature);
	} catch (error: any) {
		console.error("Error generating upload signature:", error);
		return c.json({ message: error.message }, 500);
	}
});

export default cloudinaryRoutes;
