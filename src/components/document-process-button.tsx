"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  processDocumentAction,
  type DocumentActionState,
} from "@/app/admin/document-actions";

const initialState: DocumentActionState = { status: "idle", message: null };

export function DocumentProcessButton({
  documentId,
  processingStatus,
}: {
  documentId: string;
  processingStatus: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    processDocumentAction,
    initialState,
  );

  useEffect(() => {
    if (state.status !== "idle") router.refresh();
  }, [router, state]);

  return (
    <div className="shrink-0">
      <form action={formAction}>
        <input name="documentId" type="hidden" value={documentId} />
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d6e5d7] bg-[#f4faf4] px-4 text-sm font-semibold text-[#3d684f] transition hover:bg-[#eaf4ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending
            ? "Processing PDF..."
            : processingStatus === "not_started"
              ? "Process PDF"
              : "Retry processing"}
        </button>
      </form>
      {state.message ? (
        <p
          className={`mt-2 max-w-xs text-xs leading-5 ${
            state.status === "success" ? "text-[#3d684f]" : "text-[#934d42]"
          }`}
          role={state.status === "success" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
