import { describe, expect, it } from "vitest";

import {
  feedbackPositivityPercentage,
  parseAdminAnalytics,
} from "./admin-analytics";

describe("admin analytics calculations", () => {
  it("calculates positivity from positive and negative feedback only", () => {
    expect(feedbackPositivityPercentage(3, 1)).toBe(75);
    expect(feedbackPositivityPercentage(1, 2)).toBe(33.3);
    expect(feedbackPositivityPercentage(0, 0)).toBeNull();
  });

  it("validates and maps aggregate analytics data", () => {
    expect(
      parseAdminAnalytics({
        total_questions: 4,
        total_responses: 3,
        unanswered_questions: 1,
        positive_feedback: 2,
        negative_feedback: 1,
        top_questions: [{ question: "When does the library close?", count: 2 }],
        unanswered_question_list: [
          {
            question: "What is my event rank?",
            asked_at: "2026-10-28T12:00:00.000Z",
          },
        ],
      }),
    ).toEqual({
      totalQuestions: 4,
      totalResponses: 3,
      unansweredQuestions: 1,
      positiveFeedback: 2,
      negativeFeedback: 1,
      feedbackPositivityPercentage: 66.7,
      topQuestions: [{ question: "When does the library close?", count: 2 }],
      unansweredQuestionList: [
        {
          question: "What is my event rank?",
          askedAt: "2026-10-28T12:00:00.000Z",
        },
      ],
    });
  });

  it("rejects malformed or negative aggregate values", () => {
    expect(parseAdminAnalytics({ total_questions: -1 })).toBeNull();
    expect(
      parseAdminAnalytics({
        total_questions: 0,
        total_responses: 0,
        unanswered_questions: 0,
        positive_feedback: 0,
        negative_feedback: 0,
        top_questions: [],
        unanswered_question_list: [{ question: "Bad date", asked_at: "invalid" }],
      }),
    ).toBeNull();
  });
});
