import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { AuthStatus } from "@/components/auth-status";
import { ChatInterface } from "@/components/chat-interface";
import { DashboardShell } from "@/components/dashboard-shell";
import { getViewerContext } from "@/lib/auth";
import { readStoredCitations } from "@/lib/rag";
import { logSupabaseError } from "@/lib/supabase/diagnostics";

export const maxDuration = 120;

export default function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ chatId?: string }>;
}) {
  return (
    <Suspense fallback={<StudentDashboardFallback />}>
      <StudentDashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

function StudentDashboardFallback() {
  return (
    <main
      aria-label="Loading student workspace"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
    >
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-[#e5eae2]" />
        <div className="mt-5 h-10 w-72 max-w-full rounded bg-[#e5eae2]" />
        <div className="mt-4 h-4 w-full max-w-xl rounded bg-[#e5eae2]" />
        <div className="mt-10 h-48 rounded-3xl border border-[#e3e9e1] bg-white" />
      </div>
      <span className="sr-only">Loading your workspace...</span>
    </main>
  );
}

async function StudentDashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ chatId?: string }>;
}) {
  await connection();
  const viewer = await getViewerContext();

  if (viewer.status === "not-configured") {
    return (
      <AuthStatus
        message="Add your Supabase project URL and publishable key to the local environment, then restart the app."
        title="Connect Supabase to continue"
      />
    );
  }

  if (viewer.status === "error") {
    return (
      <AuthStatus
        message="We could not verify your account or load its profile. Please try again."
        title="Your workspace could not be loaded"
      />
    );
  }

  if (viewer.status === "profile-unavailable") {
    return (
      <AuthStatus
        message="The profiles table is missing from the Supabase schema or its schema cache is stale. Review and apply supabase/migrations/20261027010000_profiles_repair.sql in the Supabase SQL Editor, then try again."
        title="Your profile table is unavailable"
      />
    );
  }

  if (viewer.status === "unauthenticated") {
    redirect("/login?next=%2Fdashboard");
  }

  if (viewer.role === "admin") {
    redirect("/admin");
  }

  const { chatId: requestedChatId } = await searchParams;
  const { data: chats, error: chatsError } = await viewer.supabase
    .from("chats")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .range(0, 20);

  if (chatsError) {
    logSupabaseError("chats.loadHistory", chatsError);
    return (
      <AuthStatus
        message="Your chat history could not be loaded. Please try again."
        title="Chats are unavailable"
      />
    );
  }

  const firstUserMessageByChat = new Map<string, string>();
  const untitledChatIds = chats
    .filter((chat) => !chat.title)
    .map((chat) => chat.id);
  if (untitledChatIds.length > 0) {
    const { data: firstMessages, error: firstMessagesError } =
      await viewer.supabase
        .from("messages")
        .select("chat_id, content")
        .in("chat_id", untitledChatIds)
        .eq("sender", "user")
        .order("created_at", { ascending: true });

    if (firstMessagesError) {
      logSupabaseError("messages.loadChatTitles", firstMessagesError);
    } else {
      for (const message of firstMessages) {
        if (!firstUserMessageByChat.has(message.chat_id)) {
          firstUserMessageByChat.set(message.chat_id, message.content);
        }
      }
    }
  }

  const activeChat =
    requestedChatId === "new"
      ? null
      : requestedChatId
        ? chats.find((chat) => chat.id === requestedChatId) ?? null
        : chats[0] ?? null;
  let selectedChat = activeChat;
  if (
    requestedChatId &&
    requestedChatId !== "new" &&
    !selectedChat
  ) {
    const { data: requestedChat, error: requestedChatError } = await viewer.supabase
      .from("chats")
      .select("id, title, updated_at")
      .eq("id", requestedChatId)
      .eq("user_id", viewer.user.id)
      .maybeSingle();

    if (requestedChatError) {
      logSupabaseError("chats.loadSelectedHistory", requestedChatError);
      return (
        <AuthStatus
          message="Your chat could not be loaded. Please try again."
          title="Chat is unavailable"
        />
      );
    }
    selectedChat = requestedChat;
  }
  const historyChats = chats.slice(0, 20);
  if (selectedChat && !historyChats.some((chat) => chat.id === selectedChat.id)) {
    historyChats.push(selectedChat);
  }
  if (selectedChat && !selectedChat.title && !firstUserMessageByChat.has(selectedChat.id)) {
    const { data: firstMessage, error: firstMessageError } = await viewer.supabase
      .from("messages")
      .select("content")
      .eq("chat_id", selectedChat.id)
      .eq("sender", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstMessageError) {
      logSupabaseError("messages.loadSelectedChatTitle", firstMessageError);
    } else if (firstMessage) {
      firstUserMessageByChat.set(selectedChat.id, firstMessage.content);
    }
  }
  let initialMessages: {
    id: string;
    sender: "user" | "assistant";
    content: string;
    citations: ReturnType<typeof readStoredCitations>;
    feedback: "positive" | "negative" | null;
  }[] = [];
  let feedbackLoadError: string | null = null;

  if (selectedChat) {
    const { data: messages, error: messagesError } = await viewer.supabase
      .from("messages")
      .select("id, sender, content, citations")
      .eq("chat_id", selectedChat.id)
      .order("created_at", { ascending: true })
      .limit(50);

    if (messagesError) {
      logSupabaseError("messages.loadHistory", messagesError);
      return (
        <AuthStatus
          message="The chat history could not be loaded. Verify that the Phase 3 migration has been applied."
          title="Messages are unavailable"
        />
      );
    }

    const feedbackByMessageId = new Map<
      string,
      "positive" | "negative"
    >();
    const assistantMessageIds = messages
      .filter((message) => message.sender === "assistant")
      .map((message) => message.id);
    if (assistantMessageIds.length > 0) {
      const { data: feedbackRows, error: feedbackError } = await viewer.supabase
        .from("feedback")
        .select("message_id, sentiment")
        .eq("user_id", viewer.user.id)
        .in("message_id", assistantMessageIds);
      if (feedbackError) {
        logSupabaseError("feedback.loadHistory", feedbackError);
        feedbackLoadError =
          "Previously submitted feedback could not be loaded. You can still submit feedback again.";
      } else {
        for (const feedback of feedbackRows) {
          if (
            feedback.sentiment === "positive" ||
            feedback.sentiment === "negative"
          ) {
            feedbackByMessageId.set(feedback.message_id, feedback.sentiment);
          }
        }
      }
    }

    initialMessages = messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      content: message.content,
      citations: readStoredCitations(message.citations),
      feedback: feedbackByMessageId.get(message.id) ?? null,
    }));
  }

  return (
    <DashboardShell email={viewer.user.email ?? ""} section="student">
      <div className="flex min-h-0 flex-1">
        <ChatInterface
          key={activeChat?.id ?? "new"}
          chats={historyChats.map(({ id, title, updated_at }) => ({
            id,
            title: title || firstUserMessageByChat.get(id) || null,
            updatedAt: updated_at,
          }))}
          selectedChatId={selectedChat?.id ?? null}
          selectedMessages={initialMessages}
          feedbackLoadError={feedbackLoadError}
          hasExplicitSelection={requestedChatId !== undefined}
          hasMoreChats={chats.length > 20}
          initialHistoryCount={Math.min(chats.length, 20)}
          initialHistoryIds={chats.slice(0, 20).map((chat) => chat.id)}
        />
      </div>
    </DashboardShell>
  );
}
