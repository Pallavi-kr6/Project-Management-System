import { ApiError } from "./errors";
import { uuidSchema } from "@/validations/common";
function validationError(error) {
    return new ApiError(400, "VALIDATION_ERROR", "Some fields are invalid", error.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message })));
}
export function parseWith(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success)
        throw validationError(result.error);
    return result.data;
}
/** Reads and parses a JSON body. Requires Content-Type: application/json. */
export async function readJson(request) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
        throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
    }
    try {
        return await request.json();
    }
    catch {
        throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
}
export async function parseBody(request, schema) {
    return parseWith(schema, await readJson(request));
}
/** Parses query-string params; empty values (?status=) are treated as "not provided". */
export function parseQuery(request, schema) {
    const raw = {};
    request.nextUrl.searchParams.forEach((value, key) => {
        if (value !== "")
            raw[key] = value;
    });
    return parseWith(schema, raw);
}
export function parseId(id, label = "id") {
    const result = uuidSchema.safeParse(id);
    if (!result.success)
        throw new ApiError(400, "INVALID_ID", `Invalid ${label}`);
    return result.data;
}
