import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getViewerContext: vi.fn(),
  from: vi.fn(),
  messageSelect: vi.fn(),
  messageEq: vi.fn(),
  messageMaybeSingle: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getViewerContext: mocks.getViewerContext,
}));

vi.mock("@/lib/supabase/diagnostics", () => ({
  logSupabaseError: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/gemini", () => ({
  generateGroundedAnswer: vi.fn(),
  hasGeminiApiKey: vi.fn(),
  embedTexts: vi.fn(),
  GeminiApiError: class GeminiApiError extends Error {},
}));

vi.mock("@/lib/rag", () => ({
  mapRetrievedChunks: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
}));

import { saveMessageFeedbackAction } from "./chat-actions";

const messageId = "22222222-2222-4222-8222-222222222222";

describe("saveMessageFeedbackAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      role: "student",
      user: { id: "11111111-1111-4111-8111-111111111111" },
      supabase: { from: mocks.from },
    });
    mocks.from.mockImplementation((table: string) =>
      table === "messages"
        ? { select: mocks.messageSelect }
        : { upsert: mocks.upsert },
    );
    mocks.messageSelect.mockReturnValue({ eq: mocks.messageEq });
    mocks.messageEq.mockReturnValue({ maybeSingle: mocks.messageMaybeSingle });
    mocks.messageMaybeSingle.mockResolvedValue({
      data: { id: messageId, sender: "assistant" },
      error: null,
    });
    mocks.upsert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
  });

  it("saves positive feedback with the unique user/message conflict key", async () => {
    mocks.single.mockResolvedValue({
      data: { message_id: messageId, sentiment: "positive" },
      error: null,
    });

    await expect(
      saveMessageFeedbackAction(messageId, "positive"),
    ).resolves.toEqual({
      status: "success",
      messageId,
      sentiment: "positive",
    });
    expect(mocks.from).toHaveBeenCalledWith("feedback");
    expect(mocks.from).toHaveBeenCalledWith("messages");
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        message_id: messageId,
        sentiment: "positive",
        rating: 5,
      },
      { onConflict: "user_id,message_id" },
    );
  });

  it("changes an existing rating through the same upsert key", async () => {
    mocks.single
      .mockResolvedValueOnce({
        data: { message_id: messageId, sentiment: "positive" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { message_id: messageId, sentiment: "negative" },
        error: null,
      });

    await saveMessageFeedbackAction(messageId, "positive");
    await expect(
      saveMessageFeedbackAction(messageId, "negative"),
    ).resolves.toMatchObject({ status: "success", sentiment: "negative" });

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[1][0]).toMatchObject({
      message_id: messageId,
      sentiment: "negative",
      rating: 1,
    });
    expect(mocks.upsert.mock.calls[1][1]).toEqual({
      onConflict: "user_id,message_id",
    });
  });

  it("rejects non-student accounts before database access", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      role: "admin",
      user: { id: "11111111-1111-4111-8111-111111111111" },
      supabase: { from: mocks.from },
    });
    await expect(
      saveMessageFeedbackAction(messageId, "positive"),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects user messages and messages hidden by ownership RLS", async () => {
    mocks.messageMaybeSingle
      .mockResolvedValueOnce({
        data: { id: messageId, sender: "user" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      saveMessageFeedbackAction(messageId, "positive"),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      saveMessageFeedbackAction(messageId, "positive"),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed identifiers and unsupported sentiments", async () => {
    await expect(
      saveMessageFeedbackAction("not-a-uuid", "positive"),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      // @ts-expect-error Test invalid client input at the server-action boundary.
      saveMessageFeedbackAction(messageId, "neutral"),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns an actionable error when the new feedback column is missing", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST204",
        message: "Could not find the sentiment column in the schema cache.",
      },
    });

    await expect(
      saveMessageFeedbackAction(messageId, "positive"),
    ).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining(
        "20261029050000_feedback_admin_analytics.sql",
      ),
    });
  });
});
