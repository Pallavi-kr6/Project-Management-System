"use client";
import useSWR, { mutate as globalMutate } from "swr";
import { api, ApiClientError, toQuery } from "@/lib/api/client";
/** Don't hammer the API with retries for errors a retry cannot fix (4xx). */
export const swrConfig = {
    revalidateOnFocus: true,
    shouldRetryOnError: true,
    onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500)
            return;
        if (retryCount >= 2)
            return;
        setTimeout(() => revalidate({ retryCount }), 3000);
    },
};
export function useCurrentUser() {
    return useSWR("/api/auth/me", async () => (await api.auth.me()).data.user);
}
export function useProjects(params) {
    return useSWR(`/api/projects${toQuery({ ...params })}`, () => api.projects.list(params), { keepPreviousData: true });
}
export function useProject(id) {
    return useSWR(`/api/projects/${id}`, async () => (await api.projects.get(id)).data, { keepPreviousData: true });
}
export function useTasks(params) {
    return useSWR(`/api/tasks${toQuery({ ...params })}`, () => api.tasks.list(params), { keepPreviousData: true });
}
export function useDashboard() {
    return useSWR("/api/dashboard", async () => (await api.dashboard.get()).data, { keepPreviousData: true });
}
/**
 * After any write, make sure nothing stale can be shown:
 *  - cached entries are cleared, so a page that is not mounted right now loads fresh data (and a
 *    skeleton) the next time it opens instead of flashing old numbers;
 *  - views that ARE mounted keep showing their previous data (keepPreviousData) while they refetch,
 *    so there is no flicker and no lost UI state such as open filters.
 */
export function revalidateData() {
    return globalMutate((key) => typeof key === "string" && (key.startsWith("/api/projects") || key.startsWith("/api/tasks") || key === "/api/dashboard"), undefined, { revalidate: true });
}
