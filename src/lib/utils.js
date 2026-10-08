import clsx from "clsx";
export function cn(...inputs) {
    return clsx(inputs);
}
/** Today's date in the user's local timezone as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
/** Format a YYYY-MM-DD string without timezone shifts (new Date("2026-01-01") would be UTC). */
export function formatDate(value) {
    if (!value)
        return "—";
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d)
        return "—";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(y, m - 1, d));
}
export function formatDateTime(value) {
    if (!value)
        return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "—";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
export function isOverdue(dueDate, status, today = todayISO()) {
    return Boolean(dueDate) && status !== "Completed" && dueDate < today;
}
/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
export function escapeLike(input) {
    return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
export function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return "?";
    const first = parts[0][0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
    return (first + last).toUpperCase();
}
export function percent(part, total) {
    if (!total)
        return 0;
    return Math.round((part / total) * 100);
}
