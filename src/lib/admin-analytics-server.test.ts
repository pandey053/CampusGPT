import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  logSupabaseError: vi.fn(),
}));

vi.mock("@/lib/supabase/diagnostics", () => ({
  logSupabaseError: mocks.logSupabaseError,
}));

import { loadAdminAnalytics } from "./admin-analytics-server";

describe("loadAdminAnalytics authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not query analytics for a student", async () => {
    const viewer = {
      role: "student" as const,
      supabase: { rpc: mocks.rpc } as unknown as SupabaseClient<Database>,
    };

    await expect(loadAdminAnalytics(viewer)).resolves.toMatchObject({
      analytics: null,
      error: "Administrator access is required to view analytics.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("loads and parses aggregates for an administrator", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        total_questions: 3,
        total_responses: 3,
        unanswered_questions: 1,
        positive_feedback: 1,
        negative_feedback: 1,
        top_questions: [],
        unanswered_question_list: [],
      },
      error: null,
    });
    const viewer = {
      role: "admin" as const,
      supabase: { rpc: mocks.rpc } as unknown as SupabaseClient<Database>,
    };

    await expect(loadAdminAnalytics(viewer)).resolves.toMatchObject({
      analytics: {
        totalQuestions: 3,
        totalResponses: 3,
        unansweredQuestions: 1,
        feedbackPositivityPercentage: 50,
      },
      error: null,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_admin_analytics");
  });
});
