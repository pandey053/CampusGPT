export type AdminAnalytics = {
  totalQuestions: number;
  totalResponses: number;
  unansweredQuestions: number;
  positiveFeedback: number;
  negativeFeedback: number;
  feedbackPositivityPercentage: number | null;
  topQuestions: { question: string; count: number }[];
  unansweredQuestionList: { question: string; askedAt: string }[];
};

export function feedbackPositivityPercentage(
  positive: number,
  negative: number,
): number | null {
  const total = positive + negative;
  return total > 0 ? Math.round((positive / total) * 1000) / 10 : null;
}

export function parseAdminAnalytics(value: unknown): AdminAnalytics | null {
  if (!isRecord(value)) return null;

  const totalQuestions = nonNegativeInteger(value.total_questions);
  const totalResponses = nonNegativeInteger(value.total_responses);
  const unansweredQuestions = nonNegativeInteger(value.unanswered_questions);
  const positiveFeedback = nonNegativeInteger(value.positive_feedback);
  const negativeFeedback = nonNegativeInteger(value.negative_feedback);
  const topQuestions = parseTopQuestions(value.top_questions);
  const unansweredQuestionList = parseUnanswered(value.unanswered_question_list);

  if (
    totalQuestions === null ||
    totalResponses === null ||
    unansweredQuestions === null ||
    positiveFeedback === null ||
    negativeFeedback === null ||
    topQuestions === null ||
    unansweredQuestionList === null
  ) {
    return null;
  }

  return {
    totalQuestions,
    totalResponses,
    unansweredQuestions,
    positiveFeedback,
    negativeFeedback,
    feedbackPositivityPercentage: feedbackPositivityPercentage(
      positiveFeedback,
      negativeFeedback,
    ),
    topQuestions,
    unansweredQuestionList,
  };
}

function parseTopQuestions(value: unknown): AdminAnalytics["topQuestions"] | null {
  if (!Array.isArray(value)) return null;
  const result: AdminAnalytics["topQuestions"] = [];

  for (const item of value) {
    if (!isRecord(item) || typeof item.question !== "string") return null;
    const count = nonNegativeInteger(item.count);
    if (count === null) return null;
    result.push({ question: item.question, count });
  }
  return result;
}

function parseUnanswered(
  value: unknown,
): AdminAnalytics["unansweredQuestionList"] | null {
  if (!Array.isArray(value)) return null;
  const result: AdminAnalytics["unansweredQuestionList"] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.question !== "string" ||
      typeof item.asked_at !== "string" ||
      !Number.isFinite(Date.parse(item.asked_at))
    ) {
      return null;
    }
    result.push({ question: item.question, askedAt: item.asked_at });
  }
  return result;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
