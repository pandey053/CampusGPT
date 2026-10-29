"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signOutAction(
  previousState: string | null,
  formData: FormData,
): Promise<string | null> {
  void previousState;
  void formData;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Supabase sign-out failed:", error);
      return "We could not log you out. Please try again.";
    }
  } catch (error) {
    console.error("Supabase sign-out failed:", error);
    return "We could not log you out. Please try again.";
  }

  redirect("/login");
}
