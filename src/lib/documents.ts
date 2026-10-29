export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
export const COLLEGE_DOCUMENTS_BUCKET = "college-documents";

export type DocumentRecord = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  mime_type: string | null;
  uploaded_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function getDocumentProcessingStatus(
  metadata: Record<string, unknown>,
): string {
  const status = metadata.processing_status;

  if (typeof status !== "string" || status === "not_started") {
    return "Not processed";
  }

  return status.replaceAll("_", " ");
}

export function getDocumentProcessingError(
  metadata: Record<string, unknown>,
): string | null {
  const error = metadata.processing_error;
  return typeof error === "string" && error.trim() ? error : null;
}

export function validatePdfFileDetails(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Choose a file with a .pdf extension.";
  }

  if (file.type !== "application/pdf") {
    return "The selected file must have the PDF MIME type.";
  }

  if (file.size === 0) {
    return "The selected PDF is empty.";
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return "PDF files must be 20 MiB or smaller.";
  }

  return null;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}
