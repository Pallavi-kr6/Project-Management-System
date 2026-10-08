import { NextResponse } from "next/server";
import { ApiError } from "./errors";
export function ok(data, options = {}) {
    const body = { success: true, data, ...(options.meta ? { meta: options.meta } : {}) };
    return NextResponse.json(body, { status: options.status ?? 200 });
}
export function fail(status, code, message, details, headers) {
    const body = { success: false, error: { code, message, ...(details ? { details } : {}) } };
    return NextResponse.json(body, { status, headers });
}
/** Converts anything thrown inside a route into a safe, consistent JSON error. Never leaks internals. */
export function handleError(error) {
    if (error instanceof ApiError) {
        return fail(error.status, error.code, error.message, error.details, error.headers);
    }
    if (process.env.NODE_ENV !== "test") {
        console.error(JSON.stringify({ level: "error", msg: "Unhandled API error", error: String(error) }));
    }
    return fail(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
}
export function buildMeta(page, pageSize, total) {
    return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
