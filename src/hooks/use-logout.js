"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
export function useLogout() {
    const [loading, setLoading] = useState(false);
    const toast = useToast();
    async function logout() {
        setLoading(true);
        try {
            await api.auth.logout();
            // Full page navigation also wipes the in-memory SWR cache, so the next user never sees stale data.
            window.location.assign("/login");
        }
        catch (e) {
            setLoading(false);
            toast({ variant: "error", title: "Could not sign out", description: e.message });
        }
    }
    return { logout, loading };
}
