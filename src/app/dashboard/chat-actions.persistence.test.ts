import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getViewerContext: vi.fn(),
  embedTexts: vi.fn(),
  hasGeminiApiKey: vi.fn(),
  generateGroundedAnswer: vi.fn(),
  mapRetrievedChunks: vi.fn(),
  consumeRateLimit: vi.fn(),
  createServiceRoleClient: vi.fn(),
  viewerFrom: vi.fn(),
  viewerRpc: vi.fn(),
  chatSelect: vi.fn(),
  chatEq: vi.fn(),
  chatMaybeSingle: vi.fn(),
  serviceRpc: vi.fn(),
  logSupabaseError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getViewerContext: mocks.getViewerContext,
}));

vi.mock("@/lib/gemini", () => ({
  generateGroundedAnswer: mocks.generateGroundedAnswer,
  hasGeminiApiKey: mocks.hasGeminiApiKey,
  embedTexts: mocks.embedTexts,
  GeminiApiError: class GeminiApiError extends Error {},
}));

vi.mock("@/lib/rag", () => ({
  mapRetrievedChunks: mocks.mapRetrievedChunks,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));

vi.mock("@/lib/supabase/diagnostics", () => ({
  logSupabaseError: mocks.logSupabaseError,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

import { askQuestionAction } from "./chat-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const chatId = "22222222-2222-4222-8222-222222222222";
const source = {
  id: "chunk-1",
  documentId: "document-1",
  title: "Campus handbook",
  pageNumber: 3,
  excerpt: "The library closes at 9 pm.",
};
const retrievedMatch = {
  chunk_id: "chunk-1",
  document_id: "document-1",
  title: "Campus handbook",
  content: "The library closes at 9 pm.",
  metadata: { page_number: 3 },
  similarity: 0.9,
};

describe("askQuestionAction secure persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      role: "student",
      user: { id: userId },
      supabase: {
        from: mocks.viewerFrom,
        rpc: mocks.viewerRpc,
      },
    });
    mocks.viewerFrom.mockReturnValue({ select: mocks.chatSelect });
    mocks.chatSelect.mockReturnValue({ eq: mocks.chatEq });
    mocks.chatEq.mockReturnValue({
      eq: mocks.chatEq,
      maybeSingle: mocks.chatMaybeSingle,
    });
    mocks.chatMaybeSingle.mockResolvedValue({
      data: { id: chatId },
      error: null,
    });
    mocks.viewerRpc.mockResolvedValue({
      data: [retrievedMatch],
      error: null,
    });
    mocks.embedTexts.mockResolvedValue([[0.1, 0.2]]);
    mocks.hasGeminiApiKey.mockReturnValue(true);
    mocks.mapRetrievedChunks.mockReturnValue([source]);
    mocks.generateGroundedAnswer.mockResolvedValue({
      answer: "The library closes at 9 pm.",
      citations: [source],
    });
    mocks.consumeRateLimit.mockReturnValue(true);
    mocks.serviceRpc.mockResolvedValue({
      data: [
        {
          user_message_id: "33333333-3333-4333-8333-333333333333",
          assistant_message_id: "44444444-4444-4444-8444-444444444444",
        },
      ],
      error: null,
    });
    mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.serviceRpc });
  });

  it("persists a legitimate exchange through the server-only service client", async () => {
    const result = await askQuestionAction("When does the library close?", chatId);

    expect(result).toMatchObject({
      status: "success",
      answer: "The library closes at 9 pm.",
    });
    expect(mocks.serviceRpc).toHaveBeenCalledWith("save_chat_exchange", {
      p_user_id: userId,
      p_chat_id: chatId,
      p_question: "When does the library close?",
      p_answer: "The library closes at 9 pm.",
      p_citations: [source],
      p_evidence_found: true,
    });
    expect(mocks.viewerRpc).toHaveBeenCalledTimes(1);
    expect(mocks.viewerRpc).toHaveBeenCalledWith(
      "match_document_chunks",
      expect.any(Object),
    );
  });

  it("does not accept client-supplied assistant answers or evidence flags", async () => {
    mocks.mapRetrievedChunks.mockReturnValueOnce([]);

    await Reflect.apply(
      askQuestionAction,
      undefined,
      ["When does the library close?", chatId, "Forged answer", true],
    );

    expect(mocks.serviceRpc).toHaveBeenCalledWith(
      "save_chat_exchange",
      expect.objectContaining({
        p_answer:
          "The answer could not be found in the available uploaded documents.",
        p_evidence_found: false,
      }),
    );
    expect(mocks.serviceRpc.mock.calls[0][1].p_answer).not.toBe(
      "Forged answer",
    );
    expect(mocks.generateGroundedAnswer).not.toHaveBeenCalled();
  });

  it("rejects cross-user chats before retrieval or privileged persistence", async () => {
    mocks.chatMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      askQuestionAction("Question for another user's chat", chatId),
    ).resolves.toMatchObject({ status: "error" });

    expect(mocks.embedTexts).not.toHaveBeenCalled();
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });

  it("does not invoke privileged persistence for unauthenticated callers", async () => {
    mocks.getViewerContext.mockResolvedValue({ status: "unauthenticated" });

    await expect(askQuestionAction("Question", chatId)).resolves.toMatchObject({
      status: "error",
    });

    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });

  it("returns an error when the database independently rejects chat ownership", async () => {
    mocks.serviceRpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "The chat is not available to this user." },
    });

    await expect(
      askQuestionAction("When does the library close?", chatId),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.logSupabaseError).toHaveBeenCalledWith(
      "chats.saveExchange",
      expect.objectContaining({ code: "42501" }),
    );
  });
});
