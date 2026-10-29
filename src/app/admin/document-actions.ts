"use server";

import { randomUUID } from "node:crypto";

import { getViewerContext } from "@/lib/auth";
import {
  COLLEGE_DOCUMENTS_BUCKET,
  hasPdfSignature,
  MAX_PDF_SIZE_BYTES,
  validatePdfFileDetails,
} from "@/lib/documents";
import { embedTexts } from "@/lib/gemini";
import {
  MAX_DOCUMENT_CHUNKS,
  extractPdfPages,
  getPdfDownloadDiagnostics,
} from "@/lib/pdf-processing";
import { chunkPages } from "@/lib/rag";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logSupabaseError } from "@/lib/supabase/diagnostics";

export type DocumentActionState =
  | { status: "idle"; message: null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const initialState: DocumentActionState = { status: "idle", message: null };

async function getAdminClient() {
  const viewer = await getViewerContext();

  if (viewer.status !== "authenticated" || viewer.role !== "admin") {
    return null;
  }

  return viewer;
}

export async function uploadDocumentAction(
  previousState: DocumentActionState = initialState,
  formData: FormData,
): Promise<DocumentActionState> {
  void previousState;

  const viewer = await getAdminClient();

  if (!viewer) {
    return {
      status: "error",
      message: "Admin authorization is required to upload documents.",
    };
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a PDF file to upload." };
  }

  const validationError = validatePdfFileDetails(file);

  if (validationError) {
    return { status: "error", message: validationError };
  }

  let signature: Uint8Array;

  try {
    signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  } catch (error) {
    console.error("Could not inspect the uploaded PDF signature:", error);
    return {
      status: "error",
      message: "The selected file could not be read. Please try again.",
    };
  }

  if (!hasPdfSignature(signature)) {
    return {
      status: "error",
      message: "The selected file does not have a valid PDF signature.",
    };
  }

  const submittedTitle = String(formData.get("title") ?? "").trim();
  const fallbackTitle = file.name.replace(/\.pdf$/i, "").trim();
  const title = submittedTitle || fallbackTitle;

  if (!title || title.length > 200) {
    return {
      status: "error",
      message: "Enter a document title between 1 and 200 characters.",
    };
  }

  const safeFileName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(-150);
  const storagePath = `${viewer.user.id}/${randomUUID()}-${safeFileName || "document.pdf"}`;
  const storage = viewer.supabase.storage.from(COLLEGE_DOCUMENTS_BUCKET);

  let storageError: Error | null = null;

  try {
    const result = await storage.upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    storageError = result.error;
  } catch (error) {
    console.error("Could not upload the college document to Storage:", error);
    return {
      status: "error",
      message: "The PDF could not be uploaded. Please try again.",
    };
  }

  if (storageError) {
    console.error("Could not upload the college document to Storage:", storageError);
    return {
      status: "error",
      message: `The PDF could not be uploaded: ${storageError.message}`,
    };
  }

  let insertError: Error | null = null;

  try {
    const result = await viewer.supabase.from("documents").insert({
      title,
      storage_path: storagePath,
      mime_type: "application/pdf",
      uploaded_by: viewer.user.id,
      metadata: {
        original_filename: file.name,
        processing_status: "not_started",
        processing_error: null,
      },
    });
    insertError = result.error;
  } catch (error) {
    console.error("Could not save uploaded document metadata:", error);
    insertError =
      error instanceof Error
        ? error
        : new Error("The document record could not be saved.");
  }

  if (insertError) {
    console.error("Could not save uploaded document metadata:", insertError);
    let cleanupError: Error | null = null;

    try {
      const cleanupResult = await storage.remove([storagePath]);
      cleanupError = cleanupResult.error;
    } catch (error) {
      console.error("Could not clean up an untracked Storage upload:", error);
      cleanupError =
        error instanceof Error
          ? error
          : new Error("Storage cleanup failed.");
    }

    if (cleanupError) {
      console.error("Could not clean up an untracked Storage upload:", cleanupError);
      return {
        status: "error",
        message:
          "The PDF reached Storage, but its document record could not be saved and automatic cleanup failed. Contact an administrator with the upload time.",
      };
    }

    return {
      status: "error",
      message: `The PDF was uploaded, but its document record could not be saved. The uploaded file was removed. ${insertError.message}`,
    };
  }

  return {
    status: "success",
    message: `"${title}" was uploaded successfully.`,
  };
}

export async function processDocumentAction(
  previousState: DocumentActionState = initialState,
  formData: FormData,
): Promise<DocumentActionState> {
  void previousState;
  const viewer = await getAdminClient();

  if (!viewer) {
    return {
      status: "error",
      message: "Admin authorization is required to process documents.",
    };
  }

  if (!consumeRateLimit(`document-processing:${viewer.user.id}`, 3, 60_000)) {
    return {
      status: "error",
      message: "Processing is temporarily rate-limited. Please try again later.",
    };
  }

  const documentId = String(formData.get("documentId") ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  ) {
    return { status: "error", message: "The document identifier is invalid." };
  }

  const { data: document, error: lookupError } = await viewer.supabase
    .from("documents")
    .select("id, title, storage_path, mime_type, metadata")
    .eq("id", documentId)
    .maybeSingle();

  if (lookupError) {
    logSupabaseError("documents.loadForProcessing", lookupError);
    return {
      status: "error",
      message: "The document could not be loaded. Please try again.",
    };
  }
  if (!document) {
    return { status: "error", message: "This document no longer exists." };
  }

  if (
    document.mime_type !== "application/pdf" ||
    !document.storage_path ||
    !isSafeStoragePath(document.storage_path)
  ) {
    return {
      status: "error",
      message: "This document does not have a valid private PDF file.",
    };
  }

  const metadata =
    document.metadata && typeof document.metadata === "object"
      ? document.metadata
      : {};
  const processingMetadata = {
    ...metadata,
    processing_status: "processing",
    processing_error: null,
    processing_started_at: new Date().toISOString(),
  };
  const { error: startError } = await viewer.supabase
    .from("documents")
    .update({ metadata: processingMetadata })
    .eq("id", document.id);

  if (startError) {
    logSupabaseError("documents.startProcessing", startError);
    return {
      status: "error",
      message: "Processing could not be started. Please try again.",
    };
  }

  try {
    const { data: file, error: downloadError } = await viewer.supabase.storage
      .from(COLLEGE_DOCUMENTS_BUCKET)
      .download(document.storage_path);

    if (downloadError || !file) {
      if (downloadError) {
        logSupabaseError("storage.downloadForProcessing", downloadError);
      }
      throw new Error("The private PDF could not be downloaded.");
    }

    if (file.size === 0 || file.size > MAX_PDF_SIZE_BYTES) {
      throw new Error("The PDF is empty or exceeds the 20 MiB processing limit.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const downloadDiagnostics = getPdfDownloadDiagnostics(bytes);
    console.info("[pdf:storage-download]", {
      blobSize: file.size,
      blobType:
        /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : "unknown",
      byteLength: bytes.byteLength,
      hasPdfSignature: downloadDiagnostics.hasPdfSignature,
      contentKind: downloadDiagnostics.contentKind,
    });

    if (bytes.byteLength !== file.size) {
      throw new Error(
        "The downloaded PDF byte length did not match the Storage response size.",
      );
    }
    if (!downloadDiagnostics.hasPdfSignature) {
      throw new Error(
        `Storage returned ${downloadDiagnostics.contentKind} data instead of a PDF.`,
      );
    }

    const pages = await extractPdfPages(bytes);
    const pageText = pages.reduce(
      (count, page) => count + (page.text.trim() ? 1 : 0),
      0,
    );
    if (pageText === 0) {
      throw new Error(
        "No selectable text was found. Scanned/image-only PDFs require OCR, which is not configured.",
      );
    }

    const chunks = chunkPages(pages, { maxChunks: MAX_DOCUMENT_CHUNKS });
    if (chunks.length === 0) {
      throw new Error("No extractable text was found in this PDF.");
    }
    const embeddings = await embedTexts(
      chunks.map((chunk) => chunk.content),
      "document",
      document.title,
    );
    const { error: removeError } = await viewer.supabase
      .from("chunks")
      .delete()
      .eq("document_id", document.id);

    if (removeError) {
      logSupabaseError("chunks.clearBeforeRetry", removeError);
      throw new Error("Existing document chunks could not be replaced.");
    }

    const { error: insertError } = await viewer.supabase.from("chunks").insert(
      chunks.map((chunk, index) => ({
        document_id: document.id,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: embeddings[index],
        metadata: { page_number: chunk.pageNumber },
      })),
    );

    if (insertError) {
      logSupabaseError("chunks.insertProcessed", insertError);
      throw new Error("The document text could not be saved.");
    }

    const { error: completeError } = await viewer.supabase
      .from("documents")
      .update({
        metadata: {
          ...processingMetadata,
          processing_status: "processed",
          processing_error: null,
          processed_at: new Date().toISOString(),
          page_count: pages.length,
          chunk_count: chunks.length,
          embedding_model: "gemini-embedding-2",
        },
      })
      .eq("id", document.id);

    if (completeError) {
      logSupabaseError("documents.completeProcessing", completeError);
      throw new Error("The document processing status could not be saved.");
    }

    return {
      status: "success",
      message: `"${document.title}" is processed (${pages.length} pages, ${chunks.length} chunks).`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The PDF could not be processed. Please retry.";
    const { error: statusError } = await viewer.supabase
      .from("documents")
      .update({
        metadata: {
          ...processingMetadata,
          processing_status: "failed",
          processing_error: message.slice(0, 500),
        },
      })
      .eq("id", document.id);

    if (statusError) {
      logSupabaseError("documents.recordProcessingFailure", statusError);
    }

    return { status: "error", message };
  }
}

function isSafeStoragePath(path: string): boolean {
  const parts = path.split("/");
  return (
    parts.length >= 2 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      parts[0],
    ) &&
    parts.every((part) => part && part !== "." && part !== "..")
  );
}

export async function deleteDocumentAction(
  previousState: DocumentActionState = initialState,
  formData: FormData,
): Promise<DocumentActionState> {
  void previousState;

  const viewer = await getAdminClient();

  if (!viewer) {
    return {
      status: "error",
      message: "Admin authorization is required to delete documents.",
    };
  }

  const documentId = String(formData.get("documentId") ?? "");

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  ) {
    return { status: "error", message: "The document identifier is invalid." };
  }

  let document:
    | { id: string; title: string; storage_path: string | null }
    | null = null;
  let lookupError: Error | null = null;

  try {
    const result = await viewer.supabase
      .from("documents")
      .select("id, title, storage_path")
      .eq("id", documentId)
      .maybeSingle();
    document = result.data;
    lookupError = result.error;
  } catch (error) {
    console.error("Could not load document before deletion:", error);
    return {
      status: "error",
      message: "The document could not be loaded. Please try again.",
    };
  }

  if (lookupError) {
    console.error("Could not load document before deletion:", lookupError);
    return {
      status: "error",
      message: `The document could not be loaded: ${lookupError.message}`,
    };
  }

  if (!document) {
    return { status: "error", message: "This document no longer exists." };
  }

  if (document.storage_path) {
    const pathParts = document.storage_path.split("/");

    if (
      pathParts.length < 2 ||
      pathParts.some((part) => !part || part === "." || part === "..")
    ) {
      console.error("Refusing to delete document with invalid Storage path:", document.id);
      return {
        status: "error",
        message:
          "The document has an invalid Storage path. Its file was left untouched.",
      };
    }

    const fileName = pathParts.pop()!;
    const folder = pathParts.join("/");
    const storage = viewer.supabase.storage.from(COLLEGE_DOCUMENTS_BUCKET);
    let objects: { name: string }[] | null = null;
    let listError: Error | null = null;

    try {
      const result = await storage.list(folder, {
        limit: 100,
        search: fileName,
      });
      objects = result.data;
      listError = result.error;
    } catch (error) {
      console.error("Could not verify the document Storage object:", error);
      return {
        status: "error",
        message:
          "The Storage file could not be checked, so the document was not deleted.",
      };
    }

    if (listError) {
      console.error("Could not verify the document Storage object:", listError);
      return {
        status: "error",
        message: `The Storage file could not be checked, so the document was not deleted: ${listError.message}`,
      };
    }

    if (objects?.some((object) => object.name === fileName)) {
      let removeError: Error | null = null;

      try {
        const result = await storage.remove([document.storage_path]);
        removeError = result.error;
      } catch (error) {
        console.error("Could not remove the document from Storage:", error);
        return {
          status: "error",
          message:
            "The PDF could not be removed from Storage, so its document record was retained.",
        };
      }

      if (removeError) {
        console.error("Could not remove the document from Storage:", removeError);
        return {
          status: "error",
          message: `The PDF could not be removed from Storage, so its document record was retained: ${removeError.message}`,
        };
      }
    }
  }

  let deletedDocument: { id: string } | null = null;
  let deleteError: Error | null = null;

  try {
    const result = await viewer.supabase
      .from("documents")
      .delete()
      .eq("id", document.id)
      .select("id")
      .maybeSingle();
    deletedDocument = result.data;
    deleteError = result.error;
  } catch (error) {
    console.error("Could not delete the document record:", error);
    deleteError =
      error instanceof Error ? error : new Error("Document delete failed.");
  }

  if (deleteError || !deletedDocument) {
    console.error(
      "The Storage file was removed but its document record could not be deleted:",
      deleteError ?? new Error("No document row was deleted."),
    );
    return {
      status: "error",
      message:
        "The Storage file is gone, but the document record could not be deleted. Retry deletion to remove the remaining record.",
    };
  }

  return {
    status: "success",
    message: `"${document.title}" was deleted.`,
  };
}
