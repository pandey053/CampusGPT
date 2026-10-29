"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  askQuestionAction,
  deleteChatAction,
  loadMoreChatHistoryAction,
  saveMessageFeedbackAction,
  type ChatActionResult,
  type FeedbackSentiment,
} from "@/app/dashboard/chat-actions";
import { MarkdownMessage } from "@/components/markdown-message";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SourceCitation } from "@/lib/rag";

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  content: string;
  citations: SourceCitation[];
  feedback: FeedbackSentiment | null;
};

type ChatSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
};

const SESSION_STARTED_KEY = "campusgpt-dashboard-session-started";

export function ChatInterface({
  chats,
  selectedChatId,
  selectedMessages,
  feedbackLoadError,
  hasExplicitSelection,
  hasMoreChats: hasMoreChatsInitially,
  initialHistoryCount,
  initialHistoryIds,
}: {
  chats: ChatSummary[];
  selectedChatId: string | null;
  selectedMessages: ChatMessage[];
  feedbackLoadError: string | null;
  hasExplicitSelection: boolean;
  hasMoreChats: boolean;
  initialHistoryCount: number;
  initialHistoryIds: string[];
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState(selectedChatId);
  const [messages, setMessages] = useState(selectedMessages);
  const [chatList, setChatList] = useState(chats);
  const [question, setQuestion] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sessionReady, setSessionReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(hasMoreChatsInitially);
  const [loadedHistoryCount, setLoadedHistoryCount] =
    useState(initialHistoryCount);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedbackPendingId, setFeedbackPendingId] = useState<string | null>(null);
  const [feedbackErrors, setFeedbackErrors] = useState<
    Record<string, string>
  >({});
  const messagesContainer = useRef<HTMLDivElement>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const hasInitializedScroll = useRef(false);
  const followLatestMessages = useRef(true);
  const sessionStarted = useRef(false);
  const freshSession = useRef(false);
  const loadedHistoryIds = useRef(new Set(initialHistoryIds));
  const submissionInProgress = useRef(false);
  const deletionInProgress = useRef(new Set<string>());
  const historyRequestInProgress = useRef(false);
  const feedbackInProgress = useRef(new Set<string>());

  useEffect(() => {
    if (!sessionStarted.current) {
      try {
        const started =
          window.sessionStorage.getItem(SESSION_STARTED_KEY) === "true";
        freshSession.current = !started;
        if (!started) window.sessionStorage.setItem(SESSION_STARTED_KEY, "true");
      } catch {
        freshSession.current = false;
      }
      sessionStarted.current = true;
    }

    const timer = window.setTimeout(() => {
      if (freshSession.current && !hasExplicitSelection) {
        setChatId(null);
        setMessages([]);
        window.history.replaceState(null, "", "/dashboard?chatId=new");
      }
      setSessionReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hasExplicitSelection]);

  useEffect(() => {
    const container = messagesContainer.current;
    if (!container || !sessionReady) return;

    if (!hasInitializedScroll.current) {
      container.scrollTop = container.scrollHeight;
      hasInitializedScroll.current = true;
    } else if (followLatestMessages.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isPending, pendingQuestion, sessionReady]);

  useEffect(() => {
    const container = messagesContainer.current;
    if (!container) return;

    function updateFollowingState() {
      if (!container) return;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      followLatestMessages.current = distanceFromBottom < 120;
    }

    container.addEventListener("scroll", updateFollowingState, {
      passive: true,
    });
    updateFollowingState();
    return () => container.removeEventListener("scroll", updateFollowingState);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !mobileMenuRef.current?.contains(event.target)
      ) {
        setMobileMenuOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        mobileMenuTrigger.current?.focus();
      }
    }

    function handleResize() {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);

  const groupedChats = useMemo(() => groupChats(chatList), [chatList]);

  function startNewChat() {
    setChatId(null);
    setMessages([]);
    setQuestion("");
    setPendingQuestion(null);
    setErrorMessage(null);
    setDeleteError(null);
    setSidebarOpen(false);
    router.replace("/dashboard?chatId=new", { scroll: false });
    questionInput.current?.focus();
  }

  async function submitFeedback(
    messageId: string,
    sentiment: FeedbackSentiment,
  ) {
    if (feedbackInProgress.current.has(messageId)) return;
    feedbackInProgress.current.add(messageId);
    setFeedbackPendingId(messageId);
    setFeedbackErrors((current) => ({ ...current, [messageId]: "" }));

    try {
      const result = await saveMessageFeedbackAction(messageId, sentiment);
      if (result.status === "error") {
        setFeedbackErrors((current) => ({
          ...current,
          [messageId]: result.message,
        }));
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === result.messageId
            ? { ...message, feedback: result.sentiment }
            : message,
        ),
      );
    } catch {
      setFeedbackErrors((current) => ({
        ...current,
        [messageId]: "Feedback could not be saved. Please retry.",
      }));
    } finally {
      feedbackInProgress.current.delete(messageId);
      setFeedbackPendingId(null);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (!isPending && question.trim()) void sendQuestion(question);
    }
  }

  function sendQuestion(value: string) {
    const submittedQuestion = value.trim();
    if (!submittedQuestion || isPending || submissionInProgress.current) return;

    submissionInProgress.current = true;
    setErrorMessage(null);
    setPendingQuestion(submittedQuestion);
    followLatestMessages.current = true;
    startTransition(async () => {
      try {
        const result: ChatActionResult = await askQuestionAction(
          submittedQuestion,
          chatId,
        );

        if (result.status === "error") {
          setPendingQuestion(null);
          setErrorMessage(result.message);
          return;
        }

        setPendingQuestion(null);
        setChatId(result.chatId);
        setMessages((current) => [
          ...current,
          {
            id: result.userMessageId,
            sender: "user",
            content: submittedQuestion,
            citations: [],
            feedback: null,
          },
          {
            id: result.assistantMessageId,
            sender: "assistant",
            content: result.answer,
            citations: result.citations,
            feedback: null,
          },
        ]);
        if (!loadedHistoryIds.current.has(result.chatId)) {
          loadedHistoryIds.current.add(result.chatId);
          setLoadedHistoryCount((current) => current + 1);
        }
        const currentSummary = chatList.find(
          (chat) => chat.id === result.chatId,
        );
        setChatList((current) => [
          {
            id: result.chatId,
            title: currentSummary?.title || submittedQuestion.slice(0, 100),
            updatedAt: new Date().toISOString(),
          },
          ...current.filter((chat) => chat.id !== result.chatId),
        ]);
        setQuestion("");
        if (questionInput.current) questionInput.current.style.height = "auto";
        router.replace(
          `/dashboard?chatId=${encodeURIComponent(result.chatId)}`,
          { scroll: false },
        );
      } catch {
        setPendingQuestion(null);
        setErrorMessage(
          "Your message could not be completed. Please retry; check the conversation before resending if the connection was interrupted.",
        );
      } finally {
        submissionInProgress.current = false;
      }
    });
  }

  function deleteChat(chat: ChatSummary) {
    if (
      !window.confirm(
        `Delete "${chat.title || "this conversation"}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    if (deletionInProgress.current.has(chat.id)) return;
    deletionInProgress.current.add(chat.id);
    setDeleteError(null);
    setDeletingChatId(chat.id);
    startTransition(async () => {
      try {
        const result = await deleteChatAction(chat.id);
        if (result.status === "error") {
          setDeleteError(result.message);
          return;
        }

        setChatList((current) =>
          current.filter((item) => item.id !== chat.id),
        );
        if (loadedHistoryIds.current.delete(chat.id)) {
          setLoadedHistoryCount((current) => Math.max(0, current - 1));
        }
        if (chatId === chat.id) {
          setChatId(null);
          setMessages([]);
          router.replace("/dashboard?chatId=new", { scroll: false });
        }
      } catch {
        setDeleteError("This conversation could not be deleted. Please retry.");
      } finally {
        deletionInProgress.current.delete(chat.id);
        setDeletingChatId(null);
      }
    });
  }

  function loadMoreChats() {
    if (!hasMoreChats || isPending || historyRequestInProgress.current) return;
    historyRequestInProgress.current = true;
    setDeleteError(null);
    startTransition(async () => {
      try {
        const result = await loadMoreChatHistoryAction(loadedHistoryCount);
        if (result.status === "error") {
          setDeleteError(result.message);
          return;
        }

        const newChats = result.chats.filter(
          (chat) => !loadedHistoryIds.current.has(chat.id),
        );
        for (const chat of newChats) loadedHistoryIds.current.add(chat.id);
        setChatList((current) => [
          ...current,
          ...newChats.filter(
            (chat) => !current.some((item) => item.id === chat.id),
          ),
        ]);
        setLoadedHistoryCount((current) => current + newChats.length);
        setHasMoreChats(result.hasMore);
      } catch {
        setDeleteError("More conversations could not be loaded. Please retry.");
      } finally {
        historyRequestInProgress.current = false;
      }
    });
  }

  return (
    <div className="chat-layout relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-3xl border border-[#e3e9e1] bg-white shadow-sm">
      {sidebarOpen ? (
        <button
          aria-label="Close chat history"
          className="fixed inset-0 z-30 bg-black/35 md:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        aria-label="Chat history"
        className={`chat-sidebar absolute inset-y-0 left-0 z-40 flex min-h-0 w-[min(86vw,19rem)] flex-col border-r border-[#e3e9e1] bg-[#f7f8f4] p-3 transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "md:hidden" : ""}`}
      >
        <div className="flex items-center justify-between px-2 py-2">
          <Link
            className="text-sm font-bold tracking-tight text-[#25382d]"
            href="/dashboard?chatId=new"
          >
            Campus<span className="text-[#477963]">GPT</span>
          </Link>
          <button
            aria-label="Close chat history"
            className="icon-button md:hidden"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <button
          className="new-chat-button mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-[#dce3db] bg-white px-3 text-sm font-semibold text-[#304338] transition hover:bg-[#eef4ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
          disabled={isPending}
          onClick={startNewChat}
          type="button"
        >
          <PlusIcon />
          New Chat
        </button>

        {deleteError ? (
          <p className="mt-3 rounded-xl bg-[#fff7f5] px-3 py-2 text-xs text-[#934d42]" role="alert">
            {deleteError}
          </p>
        ) : null}

        <nav className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto" aria-label="Conversations">
          {groupedChats.length === 0 ? (
            <p className="px-3 py-4 text-xs leading-5 text-[#7b857d]">
              Your saved conversations will appear here.
            </p>
          ) : (
            groupedChats.map((group) => (
              <section key={group.label}>
                <h2 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b857d]">
                  {group.label}
                </h2>
                <ul className="space-y-1">
                  {group.chats.map((chat) => (
                    <li className="group relative" key={chat.id}>
                      <Link
                        aria-current={chat.id === chatId ? "page" : undefined}
                        className={`block truncate rounded-xl py-2.5 pl-3 pr-10 text-[13px] leading-5 transition ${
                          chat.id === chatId
                            ? "bg-[#e9f0e8] font-semibold text-[#304338]"
                            : "text-[#59675d] hover:bg-[#edf0eb]"
                        }`}
                        href={`/dashboard?chatId=${encodeURIComponent(chat.id)}`}
                        onClick={() => setSidebarOpen(false)}
                        title={chat.title || "Campus question"}
                      >
                        {chat.title || "Campus question"}
                      </Link>
                      <details className="chat-menu absolute right-1 top-1">
                        <summary
                          aria-label={`Conversation options for ${chat.title || "chat"}`}
                          className="icon-button h-8 w-8 cursor-pointer list-none"
                        >
                          <MoreIcon />
                        </summary>
                        <div className="chat-menu-popover absolute right-0 top-9 z-20 w-40 rounded-xl border border-[#e3e9e1] bg-white p-1 shadow-lg">
                          <button
                            className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-[#934d42] hover:bg-[#fff7f5] disabled:opacity-50"
                            disabled={isPending || deletingChatId === chat.id}
                            onClick={() => deleteChat(chat)}
                            type="button"
                          >
                            {deletingChatId === chat.id
                              ? "Deleting…"
                              : "Delete chat"}
                          </button>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          {hasMoreChats ? (
            <button
              className="mx-3 rounded-lg px-2 py-2 text-xs font-medium text-[#477963] hover:bg-[#edf0eb] disabled:opacity-50"
              disabled={isPending}
              onClick={loadMoreChats}
              type="button"
            >
              {isPending ? "Loading…" : "Load older chats"}
            </button>
          ) : null}
        </nav>

      </aside>

      <section
        aria-labelledby="campus-chat-title"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <header className="chat-header flex min-h-[4.25rem] shrink-0 items-center justify-between gap-3 border-b border-[#edf0eb] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label={sidebarCollapsed ? "Show chat history" : "Hide chat history"}
              className="icon-button hidden md:inline-flex"
              onClick={() => setSidebarCollapsed((current) => !current)}
              type="button"
            >
              <SidebarIcon />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#304338]" id="campus-chat-title">
                CampusGPT
              </p>
              <p className="truncate text-[11px] text-[#7b857d]">
                Answers grounded in your documents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="new-chat-button hidden min-h-9 items-center gap-2 rounded-full border border-[#dce3db] px-3 text-xs font-semibold text-[#477963] transition hover:bg-[#f7f9f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49] md:inline-flex"
              disabled={isPending}
              onClick={startNewChat}
              type="button"
            >
              <PlusIcon />
              New chat
            </button>
            <div className="relative md:hidden" ref={mobileMenuRef}>
              <button
                aria-controls="chat-mobile-actions"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                className="icon-button h-10 w-10 border border-[#dce3db] bg-white"
                onClick={() => setMobileMenuOpen((open) => !open)}
                ref={mobileMenuTrigger}
                type="button"
              >
                <MenuIcon />
              </button>
              {mobileMenuOpen ? (
                <div
                  aria-label="Chat and account actions"
                  className="chat-menu-popover absolute right-0 top-full z-50 mt-2 flex w-[min(16rem,calc(100vw-2rem))] flex-col items-start gap-2 rounded-xl border border-[#e3e9e1] bg-white p-3 shadow-lg"
                  id="chat-mobile-actions"
                  onSubmitCapture={() => setMobileMenuOpen(false)}
                  role="group"
                >
                  <button
                    className="rounded-lg px-3 py-2 text-sm font-medium text-[#304338] hover:bg-[#edf0eb]"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setSidebarOpen(true);
                    }}
                    type="button"
                  >
                    Open chat history
                  </button>
                  <button
                    className="rounded-lg px-3 py-2 text-sm font-medium text-[#304338] hover:bg-[#edf0eb] disabled:opacity-50"
                    disabled={isPending}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      startNewChat();
                    }}
                    type="button"
                  >
                    New chat
                  </button>
                  <ThemeToggle onToggle={() => setMobileMenuOpen(false)} />
                  <SignOutButton />
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div
          aria-live="polite"
          className="chat-messages min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-4 py-6 pb-10 sm:px-8 sm:py-8 sm:pb-12"
          ref={messagesContainer}
          role="log"
        >
          {feedbackLoadError ? (
            <p className="mx-auto max-w-3xl text-sm text-[#934d42]" role="alert">
              {feedbackLoadError}
            </p>
          ) : null}
          {!sessionReady ? (
            <div aria-label="Loading conversation" className="mx-auto mt-12 max-w-xl animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded bg-[#edf0eb]" />
              <div className="h-24 rounded-2xl bg-[#f7f8f4]" />
            </div>
          ) : messages.length === 0 && !pendingQuestion ? (
            <div className="mx-auto flex min-h-[min(52vh,34rem)] max-w-2xl flex-col items-center justify-center text-center">
              <div className="assistant-avatar mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9f0e8] text-[#285c49]">
                <SparkIcon />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6c8c72]">
                CampusGPT assistant
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#25382d] sm:text-3xl">
                What would you like to know?
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#707b73]">
                Ask about your uploaded documents. I’ll share the sources behind
                each answer and won’t guess when the documents don’t say.
              </p>
              <div className="mt-7 grid w-full gap-2 text-left sm:grid-cols-2">
                {[
                  "What are my technical skills?",
                  "What does my resume say about my experience?",
                  "What are the key dates in the handbook?",
                  "Summarize the document’s main points",
                ].map((example) => (
                  <button
                    className="example-question rounded-xl border border-[#e3e9e1] bg-white px-4 py-3 text-sm text-[#516157] transition hover:border-[#bacbbb] hover:bg-[#f7f9f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
                    disabled={isPending}
                    key={example}
                    onClick={() => {
                      setQuestion(example);
                      questionInput.current?.focus();
                    }}
                    type="button"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article
                aria-label={message.sender === "user" ? "Your question" : "CampusGPT answer"}
                className={`message-row mx-auto flex w-full max-w-3xl gap-3 ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
                key={message.id}
              >
                {message.sender === "assistant" ? (
                  <div className="assistant-avatar mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e9f0e8] text-[#285c49]">
                    <SparkIcon small />
                  </div>
                ) : null}
                <div
                  className={`min-w-0 max-w-[92%] px-4 py-3 text-sm leading-6 sm:max-w-[85%] ${
                    message.sender === "user"
                      ? "user-message rounded-2xl rounded-br-md bg-[#eef4ed] text-[#304338]"
                      : "assistant-message text-[#34443a]"
                  }`}
                >
                  {message.sender === "user" ? (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  ) : (
                    <>
                      <MarkdownMessage content={message.content} />
                      {message.citations.length > 0 ? (
                        <div className="citation-section mt-5 border-t border-[#e5eae2] pt-3">
                          <h2 className="text-xs font-semibold text-[#516157]">
                            Sources
                          </h2>
                          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                            {message.citations.map((citation) => (
                              <li
                                className="citation-card rounded-xl border border-[#e5eae2] bg-white px-3 py-2.5"
                                key={citation.id}
                              >
                                <p className="text-xs font-semibold text-[#3d684f]">
                                  {citation.title}
                                  {citation.pageNumber
                                    ? ` · Page ${citation.pageNumber}`
                                    : ""}
                                </p>
                                {citation.excerpt ? (
                                  <p className="mt-1 text-xs leading-5 text-[#68746c]">
                                    “{citation.excerpt}”
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap items-center gap-1">
                        <button
                          aria-label="Helpful answer"
                          aria-pressed={message.feedback === "positive"}
                          className={`feedback-button ${
                            message.feedback === "positive"
                              ? "feedback-selected"
                              : ""
                          }`}
                          disabled={feedbackPendingId === message.id}
                          onClick={() =>
                            void submitFeedback(message.id, "positive")
                          }
                          title="Helpful"
                          type="button"
                        >
                          <ThumbIcon />
                        </button>
                        <button
                          aria-label="Unhelpful answer"
                          aria-pressed={message.feedback === "negative"}
                          className={`feedback-button ${
                            message.feedback === "negative"
                              ? "feedback-selected"
                              : ""
                          }`}
                          disabled={feedbackPendingId === message.id}
                          onClick={() =>
                            void submitFeedback(message.id, "negative")
                          }
                          title="Not helpful"
                          type="button"
                        >
                          <ThumbIcon down />
                        </button>
                        {feedbackPendingId === message.id ? (
                          <span className="ml-1 text-[10px] text-[#7b857d]" role="status">
                            Saving feedback…
                          </span>
                        ) : null}
                        {feedbackErrors[message.id] ? (
                          <p
                            className="ml-2 text-xs text-[#934d42]"
                            role="alert"
                          >
                            {feedbackErrors[message.id]}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
          {pendingQuestion ? (
            <>
              <article
                aria-label="Your question"
                className="message-row mx-auto flex w-full max-w-3xl justify-end"
              >
                <div className="user-message max-w-[92%] rounded-2xl rounded-br-md bg-[#eef4ed] px-4 py-3 text-sm leading-6 text-[#304338] sm:max-w-[85%]">
                  <p className="whitespace-pre-wrap break-words">
                    {pendingQuestion}
                  </p>
                </div>
              </article>
              <div
                className="mx-auto flex w-full max-w-3xl items-center gap-3 text-sm text-[#68746c]"
                role="status"
              >
                <span className="assistant-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e9f0e8] text-[#285c49]">
                  <SparkIcon small />
                </span>
                <span>Preparing an answer</span>
                <span className="loading-dot h-2 w-2 animate-pulse rounded-full bg-[#70947a]" />
              </div>
            </>
          ) : null}
          {isPending ? (
            pendingQuestion ? null : (
              <div className="mx-auto flex w-full max-w-3xl items-center gap-3 text-sm text-[#68746c]" role="status">
                <span className="loading-dot h-2 w-2 animate-pulse rounded-full bg-[#70947a]" />
                Searching uploaded documents and preparing an answer…
              </div>
            )
          ) : null}
          {errorMessage ? (
            <p
              className="mx-auto max-w-3xl rounded-xl border border-[#f0d7d2] bg-[#fff7f5] px-4 py-3 text-sm text-[#934d42]"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>

        <form
          className="chat-composer shrink-0 border-t border-[#edf0eb] px-3 pb-4 pt-3 sm:px-6 sm:pb-5"
          onSubmit={submitQuestion}
        >
          <div className="composer-wrap mx-auto max-w-3xl rounded-2xl border border-[#dce3db] bg-[#fcfdfb] p-2 shadow-sm transition focus-within:border-[#9db6a0] focus-within:ring-2 focus-within:ring-[#70947a]/15">
            <label className="sr-only" htmlFor="campus-question">
              Your question
            </label>
            <textarea
              className="max-h-48 min-h-11 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-[#25382d] outline-none placeholder:text-[#97a098] disabled:opacity-60"
              disabled={isPending || !sessionReady}
              id="campus-question"
              maxLength={2000}
              onChange={(event) => {
                setQuestion(event.currentTarget.value);
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${Math.min(
                  event.currentTarget.scrollHeight,
                  192,
                )}px`;
              }}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message CampusGPT…"
              ref={questionInput}
              required
              rows={1}
              value={question}
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-1">
              <button
                aria-label={isPending ? "Generating answer" : "Send message"}
                className="send-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#285c49] text-white transition hover:bg-[#214c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isPending || !question.trim() || !sessionReady}
                title={isPending ? "Generating answer" : "Send message"}
                type="submit"
              >
                {isPending ? <SpinnerIcon /> : <SendIcon />}
              </button>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-[#89938b]">
            CampusGPT can make mistakes. Check the cited document passages.
          </p>
        </form>
      </section>
    </div>
  );
}

function groupChats(chats: ChatSummary[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const groups = [
    { label: "Today", chats: [] as ChatSummary[] },
    { label: "Previous 7 days", chats: [] as ChatSummary[] },
    { label: "Older", chats: [] as ChatSummary[] },
  ];

  for (const chat of chats) {
    const timestamp = new Date(chat.updatedAt).getTime();
    const group =
      timestamp >= todayStart.getTime()
        ? groups[0]
        : timestamp >= weekStart.getTime()
          ? groups[1]
          : groups[2];
    group.chats.push(chat);
  }

  return groups.filter((group) => group.chats.length > 0);
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function SidebarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <rect height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" width="18" x="3" y="4" />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
      className={down ? "rotate-180" : undefined}
    >
      <path
        d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3Zm0 0 4-8a3 3 0 0 1 2 3v3h5.3a2 2 0 0 1 1.96 2.4l-1.6 8A2 2 0 0 1 16.7 20H7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SparkIcon({ small = false }: { small?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={small ? 17 : 25}
      viewBox="0 0 24 24"
      width={small ? 17 : 25}
    >
      <path
        d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l1 2.8 2.8 1-2.8 1L19 22l-1-2.2-2.8-1 2.8-1L19 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <path d="M12 19V5m0 0L6 11m6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" className="animate-spin" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}
