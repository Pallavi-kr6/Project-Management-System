import { ApiError } from "@/lib/api/errors";
/**
 * Translates a PostgREST/Postgres error into a safe ApiError. The raw message is
 * logged server-side only; the client gets a stable code and a generic message.
 */
export function dbError(error, fallback = "Database operation failed") {
    if (process.env.NODE_ENV !== "test") {
        console.error(JSON.stringify({ level: "error", msg: "Database error", code: error.code, detail: error.message }));
    }
    const text = `${error.message ?? ""} ${error.details ?? ""}`;
    if (error.code === "23514") {
        if (text.includes("projects_date_order")) {
            return new ApiError(400, "INVALID_DATE_RANGE", "End date must be on or after the start date");
        }
        return new ApiError(400, "CONSTRAINT_VIOLATION", "One of the values is not allowed");
    }
    if (error.code === "23503")
        return new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
    if (error.code === "22P02" || error.code === "22007" || error.code === "22008") {
        return new ApiError(400, "INVALID_INPUT", "One of the values has an invalid format");
    }
    if (error.code === "42501")
        return new ApiError(403, "FORBIDDEN", "You do not have access to this resource");
    if (error.code?.startsWith("PGRST3") || error.code === "PGRST301") {
        return new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
    }
    if (error.message?.toLowerCase().includes("fetch failed")) {
        return new ApiError(503, "SERVICE_UNAVAILABLE", "The database is unreachable. Try again shortly.");
    }
    return new ApiError(500, "DATABASE_ERROR", fallback);
}
