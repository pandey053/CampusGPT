import type { ViewerContext } from "@/lib/auth";
import { logSupabaseError } from "@/lib/supabase/diagnostics";

import { parseAdminAnalytics } from "./admin-analytics";

export async function loadAdminAnalytics(
  viewer: Pick<ViewerContext, "role" | "supabase">,
) {
  if (viewer.role !== "admin") {
    return {
      analytics: null,
      error: "Administrator access is required to view analytics.",
    };
  }

  const { data, error } = await viewer.supabase.rpc("get_admin_analytics");
  if (error) {
    logSupabaseError("admin.analytics", error);
    return {
      analytics: null,
      error:
        "Analytics could not be loaded. Verify that the analytics migration is applied and try again.",
    };
  }

  const analytics = parseAdminAnalytics(data);
  if (!analytics) {
    console.error("[admin.analytics]", { code: "invalid_response" });
    return {
      analytics: null,
      error: "Analytics data returned an unexpected format.",
    };
  }
  return { analytics, error: null };
}
