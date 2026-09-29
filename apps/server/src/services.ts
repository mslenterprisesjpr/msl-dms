import { createAuth } from "@msl/auth";
import { createDb } from "@msl/db";

import { ENV } from "./env.server";

export const db = await createDb(ENV);
export const auth = createAuth(ENV, db);
