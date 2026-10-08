import { z } from "zod";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, PROJECT_STATUSES } from "@/lib/constants";
import { hasAtLeastOneField, optionalDateSchema, optionalText, requiredText } from "./common";
const statusSchema = z.enum(PROJECT_STATUSES, { error: "Status must be Not Started, In Progress or Completed" });
function dateOrderOk(v) {
    if (!v.startDate || !v.endDate)
        return true;
    return v.endDate >= v.startDate; // ISO dates compare correctly as strings
}
const dateOrderIssue = { message: "End date must be on or after the start date", path: ["endDate"] };
export const createProjectSchema = z
    .object({
    name: requiredText("Project name", 120),
    description: optionalText("Description", 2000).optional(),
    status: statusSchema.optional(),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
})
    .refine(dateOrderOk, dateOrderIssue);
export const updateProjectSchema = z
    .object({
    name: requiredText("Project name", 120).optional(),
    description: optionalText("Description", 2000).optional(),
    status: statusSchema.optional(),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
})
    .refine(hasAtLeastOneField, "Provide at least one field to update")
    .refine(dateOrderOk, dateOrderIssue);
export const projectListQuerySchema = z.object({
    search: z.string().trim().max(100).optional(),
    status: statusSchema.optional(),
    sort: z.enum(["createdAt", "name", "startDate", "endDate"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});
