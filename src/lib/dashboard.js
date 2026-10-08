import { PROJECT_STATUSES, TASK_STATUSES } from "@/lib/constants";
function distribution(keys, raw) {
    const result = {};
    for (const key of keys)
        result[key] = Number(raw?.[key] ?? 0);
    return result;
}
/** Pure function: turns raw SQL aggregates into the dashboard payload (unit-tested). */
export function buildDashboardStats(raw) {
    const taskStatusDistribution = distribution(TASK_STATUSES, raw?.tasksByStatus);
    const projectStatusDistribution = distribution(PROJECT_STATUSES, raw?.projectsByStatus);
    const stats = {
        totalProjects: Number(raw?.totalProjects ?? 0),
        totalTasks: Number(raw?.totalTasks ?? 0),
        completedTasks: taskStatusDistribution["Completed"],
        pendingTasks: taskStatusDistribution["Pending"],
        inProgressTasks: taskStatusDistribution["In Progress"],
        projectsInProgress: projectStatusDistribution["In Progress"],
    };
    return { stats, taskStatusDistribution, projectStatusDistribution };
}
