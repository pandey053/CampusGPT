"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  uploadDocumentAction,
  type DocumentActionState,
} from "@/app/admin/document-actions";
import {
  hasPdfSignature,
  MAX_PDF_SIZE_BYTES,
  validatePdfFileDetails,
} from "@/lib/documents";

const initialState: DocumentActionState = { status: "idle", message: null };

export function DocumentUploadForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    uploadDocumentAction,
    initialState,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [checkingFile, setCheckingFile] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const validationRequest = useRef(0);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state]);

  async function validateSelectedFile(file: File | undefined) {
    const requestId = ++validationRequest.current;
    setFileError(null);

    if (!file) {
      setCheckingFile(false);
      return;
    }

    const detailsError = validatePdfFileDetails(file);

    if (detailsError) {
      setFileError(detailsError);
      setCheckingFile(false);
      return;
    }

    setCheckingFile(true);

    try {
      const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());

      if (requestId !== validationRequest.current) {
        return;
      }

      if (!hasPdfSignature(signature)) {
        setFileError("The selected file does not have a valid PDF signature.");
      }
    } catch {
      if (requestId === validationRequest.current) {
        setFileError("The selected file could not be checked. Please try again.");
      }
    } finally {
      if (requestId === validationRequest.current) {
        setCheckingFile(false);
      }
    }
  }

  return (
    <section
      aria-labelledby="upload-document-title"
      className="rounded-3xl border border-[#e3e9e1] bg-white p-6 sm:p-8"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6c8c72]">
          Admin tools
        </p>
        <h2
          className="mt-2 text-xl font-semibold tracking-[-0.035em] text-[#304338]"
          id="upload-document-title"
        >
          Upload a college PDF
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#707b73]">
          Files are stored privately. After upload, start processing from the
          document list.
        </p>
      </div>

      <form
        action={formAction}
        className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-end"
        ref={formRef}
      >
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[#34443a]"
            htmlFor="document-title"
          >
            Document title
          </label>
          <input
            className="min-h-12 w-full rounded-xl border border-[#dce3db] bg-[#fcfdfb] px-4 text-sm text-[#25382d] outline-none transition placeholder:text-[#97a098] focus:border-[#70947a] focus:ring-2 focus:ring-[#70947a]/20"
            id="document-title"
            maxLength={200}
            name="title"
            placeholder="Optional; defaults to the filename"
            type="text"
          />
        </div>

        <div>
          <label
            className="mb-2 block text-sm font-medium text-[#34443a]"
            htmlFor="document-file"
          >
            PDF file
          </label>
          <input
            accept="application/pdf,.pdf"
            className="block min-h-12 w-full rounded-xl border border-[#dce3db] bg-[#fcfdfb] px-3 py-2 text-sm text-[#536157] file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-[#edf3eb] file:px-3 file:text-xs file:font-semibold file:text-[#3d684f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
            id="document-file"
            name="file"
            onChange={(event) => {
              void validateSelectedFile(event.currentTarget.files?.[0]);
            }}
            required
            type="file"
          />
          <p className="mt-2 text-xs text-[#7b857d]">
            PDF only · Maximum {MAX_PDF_SIZE_BYTES / (1024 * 1024)} MiB
          </p>
        </div>

        <button
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#285c49] px-6 text-sm font-semibold text-white transition hover:bg-[#214c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || checkingFile || Boolean(fileError)}
          type="submit"
        >
          {pending
            ? "Uploading..."
            : checkingFile
              ? "Checking PDF..."
              : "Upload PDF"}
        </button>
      </form>

      {fileError ? (
        <p
          className="mt-4 rounded-xl border border-[#f0d7d2] bg-[#fff7f5] px-4 py-3 text-sm text-[#934d42]"
          role="alert"
        >
          {fileError}
        </p>
      ) : null}
      {state.message ? (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            state.status === "success"
              ? "border-[#d8e9da] bg-[#f4faf4] text-[#3d684f]"
              : "border-[#f0d7d2] bg-[#fff7f5] text-[#934d42]"
          }`}
          role={state.status === "success" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
