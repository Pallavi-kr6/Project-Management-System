import { z } from "zod";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidSchema = z.string({ error: "Id is required" }).regex(UUID_RE, "Invalid id");
function isRealCalendarDate(value) {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
/** Strict YYYY-MM-DD that must also be a real calendar day (rejects 2026-02-31). */
export const isoDateSchema = z
    .string({ error: "Date must be a string in YYYY-MM-DD format" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine(isRealCalendarDate, "Date is not a valid calendar date");
export const optionalDateSchema = isoDateSchema.nullable().optional();
export function requiredText(label, max) {
    return z
        .string({ error: `${label} is required` })
        .trim()
        .min(1, `${label} is required`)
        .max(max, `${label} must be at most ${max} characters`);
}
export function optionalText(label, max) {
    return z
        .string({ error: `${label} must be text` })
        .trim()
        .max(max, `${label} must be at most ${max} characters`);
}
/** Refinement helper: at least one key must be present in a partial update body. */
export function hasAtLeastOneField(value) {
    return Object.values(value).some((v) => v !== undefined);
}
