import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { hasPdfSignature, MAX_PDF_SIZE_BYTES } from "./documents";
import type { PageText } from "./rag";

export const MAX_PDF_PAGES = 50;
export const MAX_DOCUMENT_CHUNKS = 60;

export type PdfDownloadDiagnostics = {
  byteLength: number;
  hasPdfSignature: boolean;
  contentKind: "pdf" | "empty" | "json" | "html" | "unknown";
};

export function getPdfDownloadDiagnostics(
  bytes: Uint8Array,
): PdfDownloadDiagnostics {
  const prefix = new TextDecoder()
    .decode(bytes.subarray(0, 32))
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  const hasSignature = hasPdfSignature(bytes);

  return {
    byteLength: bytes.byteLength,
    hasPdfSignature: hasSignature,
    contentKind:
      bytes.byteLength === 0
        ? "empty"
        : hasSignature
          ? "pdf"
          : prefix.startsWith("{") || prefix.startsWith("[")
            ? "json"
            : prefix.startsWith("<!doctype html") || prefix.startsWith("<html")
              ? "html"
              : "unknown",
  };
}

function getSafePdfErrorDetails(error: unknown): {
  name: string;
  message: string;
} {
  const name =
    error instanceof Error ? error.name.slice(0, 80) : "UnknownError";
  const message =
    error instanceof Error ? error.message : "PDF.js returned an unknown error.";

  return {
    name,
    message: message
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
      .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
      .replace(/https?:\/\/\S+/gi, "[redacted-url]")
      .replace(/[A-Za-z]:\\[^\s]+/g, "[redacted-path]")
      .replace(/[\r\n\t]+/g, " ")
      .slice(0, 240),
  };
}

export async function extractPdfPages(
  bytes: Uint8Array,
): Promise<PageText[]> {
  if (bytes.length === 0) {
    throw new Error("The PDF file is empty.");
  }

  if (bytes.length > MAX_PDF_SIZE_BYTES) {
    throw new Error("The PDF exceeds the 20 MiB processing limit.");
  }

  if (!hasPdfSignature(bytes)) {
    throw new Error("The stored file does not have a valid PDF signature.");
  }

  const loadingTask = getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });

  try {
    let pdf: Awaited<typeof loadingTask.promise>;
    try {
      pdf = await loadingTask.promise;
    } catch (error) {
      const details = getSafePdfErrorDetails(error);
      console.error("[pdf:open]", {
        ...getPdfDownloadDiagnostics(bytes),
        error: details,
      });
      throw new Error(
        `PDF.js could not open the stored PDF (${details.name}: ${details.message}).`,
      );
    }

    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(
        `This PDF has ${pdf.numPages} pages; the limit is ${MAX_PDF_PAGES}.`,
      );
    }

    const pages: PageText[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .flatMap((item) => ("str" in item ? [item.str] : []))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        pages.push({ pageNumber, text });
        page.cleanup();
      }
    } catch (error) {
      const details = getSafePdfErrorDetails(error);
      console.error("[pdf:extract-text]", {
        pageCount: pdf.numPages,
        error: details,
      });
      throw new Error(
        `PDF.js could not extract page text (${details.name}: ${details.message}).`,
      );
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
