"use server";

import { getViewerContext } from "@/lib/auth";
import {
  generateGroundedAnswer,
  hasGeminiApiKey,
  embedTexts,
  GeminiApiError,
} from "@/lib/gemini";
import { mapRetrievedChunks, type SourceCitation } from "@/lib/rag";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logSupabaseError } from "@/lib/supabase/diagnostics";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MINIMUM_SIMILARITY = 0.45;
const NOT_FOUND_ANSWER =
  "The answer could not be found in the available uploaded documents.";

export type ChatActionResult =
  | {
      status: "success";
      chatId: string;
      userMessageId: string;
      assistantMessageId: string;
      answer: string;
      citations: SourceCitation[];
    }
  | { status: "error"; message: string };

export type FeedbackSentiment = "positive" | "negative";

export async function saveMessageFeedbackAction(
  messageIdInput: string,
  sentimentInput: FeedbackSentiment,
): Promise<
  | { status: "success"; messageId: string; sentiment: FeedbackSentiment }
  | { status: "error"; message: string }
> {
  const viewer = await getViewerContext();
  if (viewer.status !== "authenticated" || viewer.role !== "student") {
    return { status: "error", message: "A verified student account is required." };
  }
  if (
    typeof messageIdInput !== "string" ||
    !isUuid(messageIdInput) ||
    (sentimentInput !== "positive" && sentimentInput !== "negative")
  ) {
    return { status: "error", message: "The feedback request is invalid." };
  }

  const { data: message, error: messageError } = await viewer.supabase
    .from("messages")
    .select("id, sender")
    .eq("id", messageIdInput)
    .maybeSingle();
  if (messageError) {
    logSupabaseError("feedback.verifyMessage", messageError);
    return {
      status: "error",
      message: "The response could not be verified. Please retry.",
    };
  }
  if (!message || message.sender !== "assistant") {
    return {
      status: "error",
      message: "Feedback is only available for your own assistant responses.",
    };
  }

  const { data, error } = await viewer.supabase
    .from("feedback")
    .upsert(
      {
        user_id: viewer.user.id,
        message_id: messageIdInput,
        sentiment: sentimentInput,
        rating: sentimentInput === "positive" ? 5 : 1,
      },
      { onConflict: "user_id,message_id" },
    )
    .select("message_id, sentiment")
    .single();

  if (error || !data) {
    if (error) {
      logSupabaseError("feedback.save", error);
    }
    const schemaUnavailable =
      error?.code === "PGRST204" || error?.code === "42703";
    return {
      status: "error",
      message: schemaUnavailable
        ? "Feedback storage is unavailable. Apply supabase/migrations/20261029050000_feedback_admin_analytics.sql in Supabase, then retry."
        : "Your feedback could not be saved. Please try again.",
    };
  }
  if (
    data.sentiment !== "positive" &&
    data.sentiment !== "negative"
  ) {
    console.error("[feedback.save]", { code: "invalid_returned_sentiment" });
    return {
      status: "error",
      message: "Your feedback could not be verified. Please retry.",
    };
  }

  return {
    status: "success",
    messageId: data.message_id,
    sentiment: data.sentiment,
  };
}

export async function deleteChatAction(
  chatIdInput: string,
): Promise<{ status: "success" } | { status: "error"; message: string }> {
  const viewer = await getViewerContext();
  if (viewer.status !== "authenticated" || viewer.role !== "student") {
    return { status: "error", message: "A verified student account is required." };
  }
  if (typeof chatIdInput !== "string" || !isUuid(chatIdInput)) {
    return { status: "error", message: "The chat identifier is invalid." };
  }

  const { data, error } = await viewer.supabase
    .from("chats")
    .delete()
    .eq("id", chatIdInput)
    .eq("user_id", viewer.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logSupabaseError("chats.delete", error);
    return { status: "error", message: "This conversation could not be deleted. Please retry." };
  }
  if (!data) {
    return { status: "error", message: "This conversation is not available." };
  }
  return { status: "success" };
}

export async function loadMoreChatHistoryAction(offset: number): Promise<
  | {
      status: "success";
      chats: { id: string; title: string | null; updatedAt: string }[];
      hasMore: boolean;
    }
  | { status: "error"; message: string }
> {
  const viewer = await getViewerContext();
  if (viewer.status !== "authenticated" || viewer.role !== "student") {
    return { status: "error", message: "A verified student account is required." };
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) {
    return { status: "error", message: "The chat history request is invalid." };
  }

  const pageSize = 20;
  const { data: rows, error } = await viewer.supabase
    .from("chats")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize);

  if (error) {
    logSupabaseError("chats.loadMoreHistory", error);
    return { status: "error", message: "More conversations could not be loaded." };
  }

  const page = rows.slice(0, pageSize);
  const firstUserMessageByChat = new Map<string, string>();
  const untitledChatIds = page.filter((chat) => !chat.title).map((chat) => chat.id);
  if (untitledChatIds.length > 0) {
    const { data: firstMessages, error: messagesError } = await viewer.supabase
      .from("messages")
      .select("chat_id, content")
      .in("chat_id", untitledChatIds)
      .eq("sender", "user")
      .order("created_at", { ascending: true });

    if (messagesError) {
      logSupabaseError("messages.loadMoreChatTitles", messagesError);
    } else {
      for (const message of firstMessages) {
        if (!firstUserMessageByChat.has(message.chat_id)) {
          firstUserMessageByChat.set(message.chat_id, message.content);
        }
      }
    }
  }

  return {
    status: "success",
    chats: page.map((chat) => ({
      id: chat.id,
      title: chat.title || firstUserMessageByChat.get(chat.id) || null,
      updatedAt: chat.updated_at,
    })),
    hasMore: rows.length > pageSize,
  };
}

export async function askQuestionAction(
  questionInput: string,
  chatIdInput: string | null,
): Promise<ChatActionResult> {
  const viewer = await getViewerContext();
  if (viewer.status !== "authenticated" || viewer.role !== "student") {
    return {
      status: "error",
      message: "A verified student account is required to ask questions.",
    };
  }

  if (!consumeRateLimit(`chat:${viewer.user.id}`, 8, 60_000)) {
    return {
      status: "error",
      message: "You have asked several questions recently. Please wait a minute.",
    };
  }

  if (typeof questionInput !== "string") {
    return { status: "error", message: "Enter a valid question." };
  }

  const question = questionInput.trim();
  if (!question || question.length > 2000) {
    return {
      status: "error",
      message: "Enter a question between 1 and 2,000 characters.",
    };
  }

  if (!hasGeminiApiKey()) {
    return {
      status: "error",
      message: "Gemini is not configured. Add GEMINI_API_KEY to the server environment.",
    };
  }

  let existingChatId: string | null = null;
  if (chatIdInput !== null) {
    if (typeof chatIdInput !== "string" || !isUuid(chatIdInput)) {
      return { status: "error", message: "The chat identifier is invalid." };
    }
    const { data: chat, error } = await viewer.supabase
      .from("chats")
      .select("id")
      .eq("id", chatIdInput)
      .eq("user_id", viewer.user.id)
      .maybeSingle();

    if (error) {
      logSupabaseError("chats.verifyOwnership", error);
      return {
        status: "error",
        message: "Your chat could not be loaded. Please retry.",
      };
    }
    if (!chat) {
      return { status: "error", message: "This chat is not available." };
    }
    existingChatId = chat.id;
  }

  try {
    const [queryEmbedding] = await withStageTiming("embedding", () =>
      embedTexts([question], "query"),
    );
    const { data: matches, error: retrievalError } =
      await withStageTiming(
        "supabase_retrieval",
        () =>
          viewer.supabase.rpc("match_document_chunks", {
            p_query_embedding: queryEmbedding,
            p_match_threshold: MINIMUM_SIMILARITY,
            p_match_count: 5,
          }),
        (result) => Boolean(result.error),
      );

    if (retrievalError) {
      console.error("[supabase:rag.matchDocumentChunks]", {
        code: retrievalError.code,
      });
      const rpcUnavailable = retrievalError.code === "PGRST202";
      return {
        status: "error",
        message: rpcUnavailable
          ? "The match_document_chunks RPC is not available in Supabase's schema cache. Verify that the function is deployed with the expected arguments and reload the API schema cache, then try again."
          : "Document search failed. Please try again; if the problem continues, contact an administrator.",
      };
    }

    const sources = mapRetrievedChunks(
      matches ?? [],
      MINIMUM_SIMILARITY,
      question,
    );
    if (process.env.NODE_ENV === "development") {
      const eligibleSourceIds = new Set(sources.map((source) => source.id));
      console.info(
        "[rag:retrieval:development]",
        (matches ?? []).map((match) => ({
          title: match.title,
          similarity: match.similarity,
          preview: match.content.replace(/\s+/g, " ").trim().slice(0, 140),
          passedToAnswer: eligibleSourceIds.has(match.chunk_id),
          hasTechnicalSkillsSection: /\btechnical skills\b/i.test(match.content),
          hasMetaHackerCup2025Round1Text:
            /\bmeta hacker cup\b[\s\S]{0,80}\b2025\b[\s\S]{0,80}\bround\s*1\b/i.test(
              match.content,
            ),
        })),
      );
    }

    let answer = NOT_FOUND_ANSWER;
    let citations: SourceCitation[] = [];

    if (sources.length > 0) {
      const contextBySourceId = new Map(
        (matches ?? []).map((match) => [match.chunk_id, match.content]),
      );
      const generated = await withStageTiming("answer_generation", () =>
        generateGroundedAnswer(question, sources, contextBySourceId),
      );
      answer = generated.answer;
      citations = generated.citations;

      if (answer.length > 12_000) {
        answer = answer.slice(0, 12_000);
      }
    }

    const persistence = await withStageTiming(
      "chat_persistence",
      async () => {
        let chatId = existingChatId;
        if (!chatId) {
          const { data: createdChat, error: createError } =
            await viewer.supabase
              .from("chats")
              .insert({ user_id: viewer.user.id, title: question.slice(0, 100) })
              .select("id")
              .single();

          if (createError || !createdChat) {
            if (createError) logSupabaseError("chats.create", createError);
            return { status: "chat_create_failed" as const };
          }
          chatId = createdChat.id;
        }

        let saved:
          | { user_message_id: string; assistant_message_id: string }[]
          | null = null;
        let saveError: Error | null = null;
        try {
          const persistenceClient = createServiceRoleClient();
          const result = await persistenceClient.rpc("save_chat_exchange", {
            p_user_id: viewer.user.id,
            p_chat_id: chatId,
            p_question: question,
            p_answer: answer,
            p_citations: citations,
            p_evidence_found: sources.length > 0,
          });
          saved = result.data;
          saveError = result.error;
          if (saveError) logSupabaseError("chats.saveExchange", saveError);
        } catch (error) {
          logSupabaseError("chats.saveExchange", error);
          saveError =
            error instanceof Error
              ? error
              : new Error("Chat persistence could not be completed.");
        }

        if (saveError || !saved?.[0]) {
          if (!existingChatId) {
            const { error: cleanupError } = await viewer.supabase
              .from("chats")
              .delete()
              .eq("id", chatId);
            if (cleanupError) {
              logSupabaseError("chats.cleanupAfterSaveFailure", cleanupError);
            }
          }
          return { status: "save_failed" as const };
        }

        return { status: "success" as const, chatId, saved: saved[0] };
      },
      (result) => result.status !== "success",
    );

    if (persistence.status === "chat_create_failed") {
      return {
        status: "error",
        message: "Your answer was generated but the chat could not be saved.",
      };
    }
    if (persistence.status === "save_failed") {
      return {
        status: "error",
        message: "Your answer could not be saved. Please try again.",
      };
    }

    return {
      status: "success",
      chatId: persistence.chatId,
      userMessageId: persistence.saved.user_message_id,
      assistantMessageId: persistence.saved.assistant_message_id,
      answer,
      citations,
    };
  } catch (error) {
    if (error instanceof GeminiApiError) {
      console.error("[gemini:question]", {
        code: error.code,
        ...(error.status ? { status: error.status } : {}),
        ...(error.diagnostics
          ? {
              operation: error.diagnostics.operation,
              model: error.diagnostics.model,
              method: error.diagnostics.method,
              ...(error.diagnostics.geminiErrorCode
                ? { geminiErrorCode: error.diagnostics.geminiErrorCode }
                : {}),
              message: error.diagnostics.message,
            }
          : {}),
      });
      return { status: "error", message: error.message };
    }
    console.error("[rag:question]", {
      name: error instanceof Error ? error.name.slice(0, 80) : "UnknownError",
    });
    return {
      status: "error",
      message: "The question could not be answered. Please try again.",
    };
  }
}

async function withStageTiming<T>(
  stage: string,
  operation: () => PromiseLike<T>,
  isFailure: (result: T) => boolean = () => false,
): Promise<T> {
  const startedAt = performance.now();
  let outcome: "success" | "error" = "success";

  try {
    const result = await operation();
    if (isFailure(result)) outcome = "error";
    return result;
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    console.info("[chat:stage-timing]", {
      stage,
      durationMs: Math.round(performance.now() - startedAt),
      outcome,
    });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
