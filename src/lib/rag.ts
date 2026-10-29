export type PageText = {
  pageNumber: number;
  text: string;
};

export type DocumentChunk = {
  chunkIndex: number;
  content: string;
  pageNumber: number;
};

export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  title: string;
  content: string;
  metadata: unknown;
  similarity: number;
};

export type SourceCitation = {
  id: string;
  documentId: string;
  title: string;
  pageNumber: number | null;
  excerpt: string;
};

const CHUNK_SIZE = 1400;
const CHUNK_OVERLAP = 180;
const MAX_EXCERPT_LENGTH = 420;
const CITATION_QUERY_STOP_WORDS = new Set([
  "from",
  "with",
  "that",
  "this",
  "what",
  "which",
  "list",
  "show",
  "tell",
  "about",
  "resume",
  "document",
]);

export function chunkPages(
  pages: PageText[],
  options: { maxChunks?: number } = {},
): DocumentChunk[] {
  const maxChunks = options.maxChunks ?? 60;
  const chunks: DocumentChunk[] = [];

  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + CHUNK_SIZE, text.length);

      if (end < text.length) {
        const boundary = text.lastIndexOf(" ", end);
        if (boundary > start + CHUNK_SIZE * 0.6) {
          end = boundary;
        }
      }

      const content = text.slice(start, end).trim();
      if (content) {
        if (chunks.length >= maxChunks) {
          throw new Error(
            `This PDF produces more than the ${maxChunks}-chunk processing limit.`,
          );
        }
        chunks.push({
          chunkIndex: chunks.length,
          content,
          pageNumber: page.pageNumber,
        });
      }

      if (end >= text.length) break;
      start = Math.max(start + 1, end - CHUNK_OVERLAP);
      while (start < text.length && text[start] === " ") start += 1;
    }
  }

  return chunks;
}

export function mapRetrievedChunks(
  matches: RetrievedChunk[],
  minimumSimilarity: number,
  question = "",
): SourceCitation[] {
  const seen = new Set<string>();
  const eligibleMatches: RetrievedChunk[] = [];

  for (const match of matches) {
    if (
      !Number.isFinite(match.similarity) ||
      match.similarity < minimumSimilarity ||
      seen.has(match.chunk_id)
    ) {
      continue;
    }

    seen.add(match.chunk_id);
    eligibleMatches.push(match);
  }

  const asksForTechnicalSkills =
    /\b(?:technical|programming)\s+skills?\b/i.test(question);
  if (asksForTechnicalSkills) {
    eligibleMatches.sort(
      (left, right) =>
        Number(hasTechnicalSkillsHeading(right.content)) -
        Number(hasTechnicalSkillsHeading(left.content)),
    );
  }

  return eligibleMatches.map((match) => {
    const metadata = isRecord(match.metadata) ? match.metadata : {};
    const page = metadata.page_number;
    return {
      id: match.chunk_id,
      documentId: match.document_id,
      title: match.title,
      pageNumber:
        typeof page === "number" && Number.isInteger(page) && page > 0
          ? page
          : null,
      excerpt: selectRelevantExcerpt(match.content, question),
    };
  });
}

export function readStoredCitations(value: unknown): SourceCitation[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.documentId !== "string" ||
      typeof item.title !== "string" ||
      typeof item.excerpt !== "string"
    ) {
      return [];
    }

    return [
      {
        id: item.id,
        documentId: item.documentId,
        title: item.title,
        pageNumber:
          typeof item.pageNumber === "number" &&
          Number.isInteger(item.pageNumber) &&
          item.pageNumber > 0
            ? item.pageNumber
            : null,
        excerpt: item.excerpt.slice(0, MAX_EXCERPT_LENGTH),
      },
    ];
  });
}

export function selectCitations(
  citationIds: unknown,
  available: SourceCitation[],
): SourceCitation[] {
  if (!Array.isArray(citationIds)) return [];

  const allowed = new Map(available.map((citation) => [citation.id, citation]));
  const selected: SourceCitation[] = [];

  for (const id of citationIds) {
    if (typeof id !== "string") continue;
    const citation = allowed.get(id);
    if (citation && !selected.some((item) => item.id === citation.id)) {
      selected.push(citation);
    }
  }

  return selected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasTechnicalSkillsHeading(content: string): boolean {
  return /\btechnical\s+skills?\b/i.test(content);
}

function selectRelevantExcerpt(content: string, question: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_EXCERPT_LENGTH) return normalized;

  const queryTerms = [
    ...new Set(
      question
        .toLowerCase()
        .match(/[a-z][a-z0-9+#.-]{2,}/g)
        ?.filter((term) => !CITATION_QUERY_STOP_WORDS.has(term)) ?? [],
    ),
  ];
  if (queryTerms.length === 0) {
    return normalized.slice(0, MAX_EXCERPT_LENGTH);
  }

  const lowerContent = normalized.toLowerCase();
  if (/\b(?:technical|programming)\s+skills?\b/i.test(question)) {
    const sectionIndex = lowerContent.search(/\btechnical\s+skills?\b/);
    if (sectionIndex >= 0) {
      const start = Math.min(
        Math.max(0, sectionIndex - 40),
        normalized.length - MAX_EXCERPT_LENGTH,
      );
      return normalized.slice(start, start + MAX_EXCERPT_LENGTH);
    }
  }

  let bestStart = 0;
  let bestScore = -1;

  for (let start = 0; start <= normalized.length - MAX_EXCERPT_LENGTH; ) {
    const end = start + MAX_EXCERPT_LENGTH;
    const excerpt = lowerContent.slice(start, end);
    const score =
      queryTerms.reduce(
        (total, term) => total + (excerpt.includes(term) ? 1 : 0),
        0,
      ) +
      (/\btechnical\s+skills?\b/i.test(question) &&
      /\btechnical\s+skills?\b/i.test(excerpt)
        ? 3
        : 0);

    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }

    const nextWord = normalized.indexOf(" ", start + 1);
    if (nextWord === -1) break;
    start = nextWord + 1;
  }

  return normalized.slice(bestStart, bestStart + MAX_EXCERPT_LENGTH);
}
