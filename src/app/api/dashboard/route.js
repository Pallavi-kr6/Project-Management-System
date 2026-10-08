import { withAuth } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getDashboard } from "@/lib/db/dashboard";
export const GET = withAuth(async ({ supabase }) => ok(await getDashboard(supabase)));
