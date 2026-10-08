import { buildDashboardStats } from "@/lib/dashboard";
import { dbError } from "./errors";
import { mapProject, mapTask } from "./mappers";
import { TASK_SELECT } from "./tasks";
/** Every number comes from the database for the signed-in user; nothing is hardcoded. */
export async function getDashboard(supabase) {
    const [statsRes, upcomingRes, recentRes] = await Promise.all([
        supabase.rpc("get_dashboard_stats"),
        supabase
            .from("tasks")
            .select(TASK_SELECT)
            .neq("status", "Completed")
            .not("due_date", "is", null)
            .order("due_date", { ascending: true })
            .limit(5),
        supabase.from("projects_with_stats").select("*").order("created_at", { ascending: false }).limit(5),
    ]);
    if (statsRes.error)
        throw dbError(statsRes.error);
    if (upcomingRes.error)
        throw dbError(upcomingRes.error);
    if (recentRes.error)
        throw dbError(recentRes.error);
    return {
        ...buildDashboardStats(statsRes.data),
        upcomingTasks: (upcomingRes.data ?? []).map(mapTask),
        recentProjects: (recentRes.data ?? []).map(mapProject),
    };
}
