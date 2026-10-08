import { ApiError } from "./api/errors";
const buckets = new Map();
const MAX_BUCKETS = 10_000;
export function checkRateLimit(key, { limit, windowMs }, now = Date.now()) {
    if (buckets.size > MAX_BUCKETS) {
        for (const [k, b] of buckets)
            if (b.resetAt <= now)
                buckets.delete(k);
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }
    bucket.count += 1;
    if (bucket.count > limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}
export function resetRateLimits() {
    buckets.clear();
}
export function getClientIp(request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded)
        return forwarded.split(",")[0].trim();
    return request.headers.get("x-real-ip") ?? "unknown";
}
/** Throws a 429 ApiError when the caller exceeded the limit for this action. */
export function enforceRateLimit(request, action, options) {
    const result = checkRateLimit(`${action}:${getClientIp(request)}`, options);
    if (!result.allowed) {
        throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", undefined, { "Retry-After": String(result.retryAfterSeconds) });
    }
}
