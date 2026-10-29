"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfigurationError, getSupabasePublicConfig } from "./env";
import type { Database } from "./database.types";

export function createClient(): SupabaseClient<Database> {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error(getSupabaseConfigurationError());
  }

  return createBrowserClient<Database>(config.url, config.publishableKey);
}
