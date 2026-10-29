import type { User } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/supabase/diagnostics";
import type { AppRole } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ViewerContext = {
  user: User;
  role: AppRole;
  supabase: SupabaseClient<Database>;
};

export type ViewerResult =
  | { status: "not-configured" }
  | { status: "unauthenticated" }
  | { status: "error" }
  | { status: "profile-unavailable" }
  | ({ status: "authenticated" } & ViewerContext);

export async function getViewerContext(): Promise<ViewerResult> {
  if (!getSupabasePublicConfig()) {
    return { status: "not-configured" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      logSupabaseError("auth.getUser", userError);
      return { status: "error" };
    }

    if (!user) {
      return { status: "unauthenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logSupabaseError("profiles.selectRole", profileError);
      if (profileError.code === "PGRST205") {
        return { status: "profile-unavailable" };
      }

      return { status: "error" };
    }

    if (!profile) {
      console.error(
        "[supabase:profiles.selectRole]",
        "No visible profile row was returned for the authenticated user.",
      );
      return { status: "profile-unavailable" };
    }

    return {
      status: "authenticated",
      user,
      role: profile.role,
      supabase,
    };
  } catch (error) {
    logSupabaseError("auth.loadViewerContext", error);
    return { status: "error" };
  }
}
