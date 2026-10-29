import { describe, expect, it } from "vitest";

import {
  chunkPages,
  mapRetrievedChunks,
  readStoredCitations,
  selectCitations,
} from "./rag";

describe("chunkPages", () => {
  it("creates overlapping chunks and keeps the originating page number", () => {
    const text = Array.from({ length: 420 }, (_, index) => `word${index}`).join(
      " ",
    );
    const chunks = chunkPages([{ pageNumber: 7, text }]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageNumber === 7)).toBe(true);
    expect(chunks[0].content.length).toBeLessThanOrEqual(1400);
    expect(chunks[0].content.slice(-200)).toContain(
      chunks[1].content.slice(0, 100),
    );
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index),
    );
  });

  it("skips empty pages and rejects documents beyond the chunk limit", () => {
    expect(chunkPages([{ pageNumber: 1, text: "  " }])).toEqual([]);
    expect(() =>
      chunkPages(
        [{ pageNumber: 1, text: "some text ".repeat(1200) }],
        { maxChunks: 1 },
      ),
    ).toThrow(/chunk processing limit/);
  });
});

describe("citation mapping", () => {
  const matches = [
    {
      chunk_id: "chunk-a",
      document_id: "document-a",
      title: "Student handbook",
      content: "The library is open until 9 pm.",
      metadata: { page_number: 14 },
      similarity: 0.82,
    },
    {
      chunk_id: "chunk-b",
      document_id: "document-b",
      title: "Old handbook",
      content: "An unrelated lower-confidence passage.",
      metadata: { page_number: 99 },
      similarity: 0.41,
    },
    {
      chunk_id: "chunk-c",
      document_id: "document-c",
      title: "Notice",
      content: "This source has no recorded page.",
      metadata: {},
      similarity: 0.7,
    },
  ];

  it("filters by similarity and maps only stored document/page metadata", () => {
    expect(mapRetrievedChunks(matches, 0.58)).toEqual([
      {
        id: "chunk-a",
        documentId: "document-a",
        title: "Student handbook",
        pageNumber: 14,
        excerpt: "The library is open until 9 pm.",
      },
      {
        id: "chunk-c",
        documentId: "document-c",
        title: "Notice",
        pageNumber: null,
        excerpt: "This source has no recorded page.",
      },
    ]);
  });

  it("accepts only citations that map to retrieved chunks", () => {
    const available = mapRetrievedChunks(matches, 0.58);
    expect(selectCitations(["chunk-a", "invented-id", "chunk-a"], available)).toEqual([
      available[0],
    ]);
    expect(readStoredCitations([{ title: "Malformed" }])).toEqual([]);
  });

  it("prefers and cites the exact Technical Skills chunk with a supporting excerpt", () => {
    const projectChunk = {
      ...matches[0],
      chunk_id: "project-chunk",
      content: "Built web applications with Python and React for course projects.",
      metadata: { page_number: 1 },
      similarity: 0.91,
    };
    const skillsChunk = {
      ...matches[1],
      chunk_id: "skills-chunk",
      content:
        `${"Project experience and application development. ".repeat(12)} ` +
        "Technical Skills: Python, TypeScript, React, Node.js, PostgreSQL.",
      metadata: { page_number: 2 },
      similarity: 0.78,
    };

    const available = mapRetrievedChunks(
      [projectChunk, skillsChunk],
      0.45,
      "List the top 5 technical skills from my resume",
    );

    expect(available[0]).toMatchObject({
      id: "skills-chunk",
      pageNumber: 2,
    });
    expect(available[0].excerpt).toContain(
      "Technical Skills: Python, TypeScript, React, Node.js, PostgreSQL.",
    );
    expect(selectCitations(["skills-chunk"], available)).toEqual([
      available[0],
    ]);
  });
});
