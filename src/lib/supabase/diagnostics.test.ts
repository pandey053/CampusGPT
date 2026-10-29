import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSafeSupabaseErrorDetails,
  logSupabaseError,
} from "./diagnostics";

describe("Supabase diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts a database code and sanitizes its message", () => {
    const details = getSafeSupabaseErrorDetails({
      code: "PGRST204",
      message: "Missing column for user@example.com at https://example.com/private",
    });

    expect(details.code).toBe("PGRST204");
    expect(details.message).toContain("[redacted-email]");
    expect(details.message).toContain("[redacted-url]");
    expect(details.message).not.toContain("user@example.com");
    expect(details.message).not.toContain("example.com/private");
  });

  it("serializes safe details in logs instead of losing error properties", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    logSupabaseError("feedback.save", {
      code: "PGRST204",
      message: "Could not find the sentiment column.",
    });

    expect(consoleError).toHaveBeenCalledWith(
      '[supabase:feedback.save] {"code":"PGRST204","message":"Could not find the sentiment column."}',
    );
  });
});
