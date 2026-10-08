import { z } from "zod";
import { requiredText } from "./common";
export const emailSchema = z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Enter a valid email address");
// bcrypt (used by Supabase Auth) only considers the first 72 bytes of a password.
export const passwordSchema = z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/\d/, "Password must contain at least one number");
export const registerSchema = z.object({
    fullName: requiredText("Full name", 100),
    email: emailSchema,
    password: passwordSchema,
});
export const loginSchema = z.object({
    email: emailSchema,
    // Do not apply strength rules on login: older/weaker passwords must still be able to sign in.
    password: z.string({ error: "Password is required" }).min(1, "Password is required").max(72),
});
