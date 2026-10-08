import { ApiError } from "./errors";
/** Maps Supabase Auth errors to safe API errors (no raw upstream messages). */
export function mapAuthError(error) {
    const code = error.code ?? "";
    if (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500) {
        return new ApiError(503, "SERVICE_UNAVAILABLE", "Authentication service is unavailable. Try again shortly.");
    }
    switch (code) {
        case "user_already_exists":
        case "email_exists":
            return new ApiError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists");
        case "weak_password":
            return new ApiError(400, "WEAK_PASSWORD", "Password is too weak. Use at least 8 characters with letters and numbers.");
        case "invalid_credentials":
            return new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
        case "email_not_confirmed":
            return new ApiError(403, "EMAIL_NOT_CONFIRMED", "Confirm your email address first, then sign in");
        case "signup_disabled":
            return new ApiError(403, "SIGNUP_DISABLED", "Sign-ups are currently disabled");
        case "over_request_rate_limit":
        case "over_email_send_rate_limit":
            return new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");
        default:
            return new ApiError(400, "AUTH_ERROR", "Authentication failed");
    }
}
