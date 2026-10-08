import { z } from "zod";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { hasAtLeastOneField, optionalDateSchema, optionalText, requiredText, uuidSchema } from "./common";
const statusSchema = z.enum(TASK_STATUSES, { error: "Status must be Pending, In Progress or Completed" });
const prioritySchema = z.enum(TASK_PRIORITIES, { error: "Priority must be Low, Medium or High" });
export const createTaskSchema = z.object({
    projectId: uuidSchema,
    name: requiredText("Task name", 160),
    description: optionalText("Description", 2000).optional(),
    priority: prioritySchema.optional(),
    status: statusSchema.optional(),
    dueDate: optionalDateSchema,
});
export const updateTaskSchema = z
    .object({
    projectId: uuidSchema.optional(),
    name: requiredText("Task name", 160).optional(),
    description: optionalText("Description", 2000).optional(),
    priority: prioritySchema.optional(),
    status: statusSchema.optional(),
    dueDate: optionalDateSchema,
})
    .refine(hasAtLeastOneField, "Provide at least one field to update");
export const taskListQuerySchema = z.object({
    search: z.string().trim().max(100).optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    projectId: uuidSchema.optional(),
    sort: z.enum(["createdAt", "name", "dueDate"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});
