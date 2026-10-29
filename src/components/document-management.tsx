import { DocumentDeleteButton } from "@/components/document-delete-button";
import { DocumentProcessButton } from "@/components/document-process-button";
import { DocumentUploadForm } from "@/components/document-upload-form";
import {
  getDocumentProcessingError,
  getDocumentProcessingStatus,
  type DocumentRecord,
} from "@/lib/documents";

type DocumentManagementProps = {
  documents: DocumentRecord[];
};

export function DocumentManagement({
  documents,
}: DocumentManagementProps) {
  return (
    <div className="space-y-6">
      <DocumentUploadForm />

      <section
        aria-labelledby="documents-title"
        className="rounded-3xl border border-[#e3e9e1] bg-white p-6 sm:p-8"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              className="text-xl font-semibold tracking-[-0.035em] text-[#304338]"
              id="documents-title"
            >
              Documents
            </h2>
            <p className="mt-1 text-sm text-[#707b73]">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </p>
            <p className="mt-2 text-xs text-[#7b857d]">
              Start or retry text extraction and indexing from each document.
            </p>
          </div>
          <span className="rounded-full bg-[#eef4ed] px-3 py-1.5 text-xs font-semibold text-[#477963]">
            Admin access verified
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#dce3db] bg-[#fcfdfb] px-5 py-8 text-center">
            <p className="text-sm font-medium text-[#516157]">
              No documents have been added
            </p>
            <p className="mt-1 text-xs leading-5 text-[#7b857d]">
              Upload a PDF to add a private campus resource.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-[#edf0eb]">
            {documents.map((document) => {
              const processingError = getDocumentProcessingError(
                document.metadata,
              );

              return (
                <li
                  className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  key={document.id}
                >
                  <div className="min-w-0">
                    <h3 className="break-words font-medium text-[#34443a]">
                      {document.title}
                    </h3>
                    <p className="mt-1 break-all text-xs text-[#879088]">
                      {document.metadata.original_filename &&
                      typeof document.metadata.original_filename === "string"
                        ? document.metadata.original_filename
                        : document.storage_path?.split("/").at(-1) ??
                          "No file path"}
                    </p>
                    <p className="mt-2 text-xs text-[#7b857d]">
                      Uploaded{" "}
                      <time dateTime={document.created_at}>
                        {new Date(document.created_at).toLocaleDateString()}
                      </time>
                    </p>
                    <p className="mt-2 text-xs text-[#68746c]">
                      Processing status:{" "}
                      <span className="font-medium capitalize text-[#516157]">
                        {getDocumentProcessingStatus(document.metadata)}
                      </span>
                    </p>
                    {processingError ? (
                      <p
                        className="mt-2 text-xs leading-5 text-[#934d42]"
                        role="alert"
                      >
                        Processing error: {processingError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {getDocumentProcessingStatus(document.metadata) !==
                    "processed" ? (
                      <DocumentProcessButton
                        documentId={document.id}
                        processingStatus={
                          typeof document.metadata.processing_status ===
                          "string"
                            ? document.metadata.processing_status
                            : "not_started"
                        }
                      />
                    ) : null}
                    <DocumentDeleteButton documentId={document.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
