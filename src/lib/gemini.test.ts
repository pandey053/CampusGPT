import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  embedTexts,
  generateGroundedAnswer,
} from "./gemini";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Gemini HTTP error diagnostics", () => {
  it("uses the documented embedding endpoint and 768-dimensional request", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-api-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          embeddings: [{ values: Array.from({ length: 768 }, () => 0.1) }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(embedTexts(["question text"], "query")).resolves.toEqual([
      Array.from({ length: 768 }, () => 0.1),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents",
    );
    expect(request.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-goog-api-key": "test-gemini-api-key",
    });
    expect(JSON.parse(request.body)).toMatchObject({
      requests: [
        {
          model: "models/gemini-embedding-2",
          output_dimensionality: 768,
        },
      ],
    });
  });

  it("uses synchronous GenerateContent and validates citations against sources", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-api-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      answer: "The library closes at 9 pm.",
                      citationIds: ["chunk-a", "unknown-id", "chunk-a"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const source = {
      id: "chunk-a",
      documentId: "document-a",
      title: "Student handbook",
      pageNumber: 14,
      excerpt: "The library closes at 9 pm.",
    };
    const fullChunk = `${"Earlier resume text. ".repeat(30)}Technical Skills: Python, TypeScript, React, Node.js, PostgreSQL.`;
    await expect(
      generateGroundedAnswer(
        "When does the library close?",
        [source],
        new Map([[source.id, fullChunk]]),
      ),
    ).resolves.toEqual({
      answer: "The library closes at 9 pm.",
      citations: [source],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    );
    expect(JSON.parse(request.body)).toMatchObject({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: expect.stringContaining(
                "Retrieved uploaded-document context:\n[chunk-a] Student handbook, page 14",
              ),
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          expect.objectContaining({
            text: expect.stringContaining(
              "clearly labeled evidence-based selection",
            ),
          }),
        ],
      },
      generationConfig: {
        thinkingConfig: { thinkingLevel: "low" },
        maxOutputTokens: 600,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          required: ["answer", "citationIds"],
        },
      },
    });
    expect(JSON.parse(request.body).contents[0].parts[0].text).toContain(
      "Technical Skills: Python, TypeScript, React, Node.js, PostgreSQL.",
    );
  });

  it("preserves safe GenerateContent API error details without logging prompt or key", async () => {
    const apiKey = "test-gemini-api-key";
    const question = "a private question that must not appear in logs";
    vi.stubEnv("GEMINI_API_KEY", apiKey);
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 404,
              status: "NOT_FOUND",
              message: "The requested model was not found.",
            },
          }),
          { status: 404 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      generateGroundedAnswer(question, [
        {
          id: "chunk-a",
          documentId: "document-a",
          title: "Handbook",
          pageNumber: null,
          excerpt: "Private document excerpt.",
        },
      ]),
    ).rejects.toMatchObject({
      code: "http_error",
      status: 404,
      diagnostics: {
        model: "gemini-3.6-flash",
        method: "generateContent",
        geminiErrorCode: "NOT_FOUND",
        message: "The requested model was not found.",
      },
    });

    const loggedDetails = JSON.stringify(consoleError.mock.calls);
    expect(loggedDetails).not.toContain(apiKey);
    expect(loggedDetails).not.toContain(question);
    expect(loggedDetails).not.toContain("Private document excerpt.");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not retry a timed-out generation request and logs only timing metadata", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-api-key");
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("Request timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const source = {
      id: "chunk-a",
      documentId: "document-a",
      title: "Student handbook",
      pageNumber: null,
      excerpt: "Library hours are 9 am to 9 pm.",
    };

    await expect(
      generateGroundedAnswer("When does the library close?", [source]),
    ).rejects.toMatchObject({
      code: "timeout",
      message: expect.stringContaining("contact an administrator"),
      diagnostics: {
        operation: "answer_generation",
        model: "gemini-3.6-flash",
        method: "generateContent",
      },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(consoleInfo.mock.calls).toContainEqual([
      "[gemini:request-timing]",
      expect.objectContaining({
        operation: "answer_generation",
        model: "gemini-3.6-flash",
        method: "generateContent",
        outcome: "timeout",
      }),
    ]);
  });

  it("logs safe API error details without logging the API key or prompt", async () => {
    const apiKey = "test-gemini-api-key";
    const prompt = "private question content that must not appear in logs";
    vi.stubEnv("GEMINI_API_KEY", apiKey);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 400,
              status: "INVALID_ARGUMENT",
              message: `Invalid request containing ${prompt}`,
            },
          }),
          { status: 400 },
        ),
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(embedTexts([prompt], "query")).rejects.toMatchObject({
      code: "http_error",
      status: 400,
      diagnostics: {
        model: "gemini-embedding-2",
        method: "batchEmbedContents",
        geminiErrorCode: "INVALID_ARGUMENT",
        message:
          "Gemini error message contained request content and was redacted.",
      },
    });

    expect(consoleError).toHaveBeenCalledOnce();
    const [context, details] = consoleError.mock.calls[0];
    expect(context).toBe("[gemini:api]");
    expect(details).toMatchObject({
      model: "gemini-embedding-2",
      method: "batchEmbedContents",
      httpStatus: 400,
      geminiErrorCode: "INVALID_ARGUMENT",
      message: "Gemini error message contained request content and was redacted.",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(apiKey);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(prompt);
  });
});
