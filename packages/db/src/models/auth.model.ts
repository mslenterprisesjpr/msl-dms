import mongoose from "mongoose";

const { Schema, model } = mongoose;
const { ObjectId } = Schema.Types;

const userSchema = new Schema(
	{
		_id: { type: ObjectId, auto: true },
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		emailVerified: { type: Boolean, required: true, default: false },
		image: { type: String },
		createdAt: { type: Date, required: true, default: Date.now },
		updatedAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: "user" },
);

const sessionSchema = new Schema(
	{
		_id: { type: ObjectId, auto: true },
		expiresAt: { type: Date, required: true },
		token: { type: String, required: true, unique: true },
		createdAt: { type: Date, required: true, default: Date.now },
		updatedAt: { type: Date, required: true, default: Date.now },
		ipAddress: { type: String },
		userAgent: { type: String },
		userId: { type: ObjectId, ref: "User", required: true },
	},
	{ collection: "session" },
);
sessionSchema.index({ userId: 1 });

const accountSchema = new Schema(
	{
		_id: { type: ObjectId, auto: true },
		accountId: { type: String, required: true },
		providerId: { type: String, required: true },
		userId: { type: ObjectId, ref: "User", required: true },
		accessToken: { type: String },
		refreshToken: { type: String },
		idToken: { type: String },
		accessTokenExpiresAt: { type: Date },
		refreshTokenExpiresAt: { type: Date },
		scope: { type: String },
		password: { type: String },
		createdAt: { type: Date, required: true, default: Date.now },
		updatedAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: "account" },
);
accountSchema.index({ providerId: 1, accountId: 1 }, { unique: true });
accountSchema.index({ userId: 1 });

const verificationSchema = new Schema(
	{
		_id: { type: ObjectId, auto: true },
		identifier: { type: String, required: true },
		value: { type: String, required: true },
		expiresAt: { type: Date, required: true },
		createdAt: { type: Date, required: true, default: Date.now },
		updatedAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: "verification" },
);
verificationSchema.index({ identifier: 1 });

// Organization schema - required for Better Auth organization plugin
const organizationSchema = new Schema(
	{
		id: { type: String, required: true, unique: true },
		name: { type: String, required: true },
		slug: { type: String, required: true, unique: true },
		logo: { type: String },
		metadata: { type: Schema.Types.Mixed },
		createdAt: { type: Date, required: true, default: Date.now },
		updatedAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: "organization" },
);
organizationSchema.index({ slug: 1 });

// Member schema - links users to organizations
const memberSchema = new Schema(
	{
		// Better Auth uses string IDs, not ObjectIds
		id: { type: String, required: true, unique: true },
		organizationId: { type: String, required: true }, // String, not ObjectId!
		userId: { type: String, required: true }, // String, not ObjectId!
		role: { type: String, required: true, default: "member" },
		createdAt: { type: Date, required: true, default: Date.now },
		updatedAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: "member", _id: false }, // Disable auto _id generation
);
memberSchema.index({ organizationId: 1 });
memberSchema.index({ userId: 1 });
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

// Invitation schema - for organization invitations
const invitationSchema = new Schema(
	{
		id: { type: String, required: true, unique: true },
		organizationId: { type: String, required: true },
		email: { type: String, required: true },
		role: { type: String, required: true, default: "member" },
		status: { type: String, required: true, default: "pending" },
		expiresAt: { type: Date, required: true },
		inviterId: { type: String, required: true },
		createdAt: { type: Date, required: true, default: Date.now },
		updatedAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: "invitation" },
);
invitationSchema.index({ organizationId: 1 });
invitationSchema.index({ email: 1 });
invitationSchema.index({ organizationId: 1, email: 1 });

const User = model("User", userSchema);
const Session = model("Session", sessionSchema);
const Account = model("Account", accountSchema);
const Verification = model("Verification", verificationSchema);
const Organization = model("Organization", organizationSchema);
const Member = model("Member", memberSchema);
const Invitation = model("Invitation", invitationSchema);

export {
	Account,
	Invitation,
	Member,
	Organization,
	Session,
	User,
	Verification,
};
