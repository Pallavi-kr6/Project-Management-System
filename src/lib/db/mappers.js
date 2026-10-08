export function mapProject(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        totalTasks: Number(row.total_tasks ?? 0),
        completedTasks: Number(row.completed_tasks ?? 0),
    };
}
export function mapTask(row) {
    const project = Array.isArray(row.project) ? (row.project[0] ?? null) : (row.project ?? null);
    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        priority: row.priority,
        status: row.status,
        dueDate: row.due_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        project,
    };
}
/** Removes keys whose value is undefined so "not provided" never overwrites a column. */
function defined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
export function toProjectRow(input) {
    return defined({
        name: input.name,
        description: input.description,
        status: input.status,
        start_date: input.startDate,
        end_date: input.endDate,
    });
}
export function toTaskRow(input) {
    return defined({
        project_id: input.projectId,
        name: input.name,
        description: input.description,
        priority: input.priority,
        status: input.status,
        due_date: input.dueDate,
    });
}
