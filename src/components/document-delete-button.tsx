"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  deleteDocumentAction,
  type DocumentActionState,
} from "@/app/admin/document-actions";

const initialState: DocumentActionState = { status: "idle", message: null };

type DocumentDeleteButtonProps = {
  documentId: string;
};

export function DocumentDeleteButton({
  documentId,
}: DocumentDeleteButtonProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    deleteDocumentAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state]);

  return (
    <div className="shrink-0">
      <form action={formAction}>
        <input name="documentId" type="hidden" value={documentId} />
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#ead8d4] px-4 text-sm font-semibold text-[#934d42] transition hover:border-[#c77f70] hover:bg-[#fff7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#934d42] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={(event) => {
            if (
              !window.confirm(
                "Delete this document and its stored PDF? This cannot be undone.",
              )
            ) {
              event.preventDefault();
            }
          }}
          type="submit"
        >
          {pending ? "Deleting..." : "Delete"}
        </button>
      </form>
      {state.status === "error" && state.message ? (
        <p className="mt-2 max-w-xs text-xs leading-5 text-[#934d42]" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
