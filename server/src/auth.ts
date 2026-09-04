import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/index";
import * as schema from "./db/schema";
import 'dotenv/config';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification
        }
    }),
    baseURL: process.env.BETTER_AUTH_URL || "https://insa-talent-1.onrender.com/api/auth",
    trustedOrigins: [
        "http://localhost:5173", 
        "https://insa-aca.vercel.app", 
        "https://aca-2026.vercel.app",
        process.env.FRONTEND_URL || "https://aca-2026.vercel.app", 
        "https://insa-talent-1.onrender.com"
    ],
    secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || "fallback_secret_for_dev",
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
        }
    },
    advanced: {
        defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
            domain: process.env.COOKIE_DOMAIN || "aca-2026.vercel.app"
        }
    }
});
