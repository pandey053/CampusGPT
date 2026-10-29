type SupabaseErrorDetails = {
  name?: string;
  code?: string;
  status?: number;
  message: string;
};

function redactDiagnosticMessage(message: string): string {
  return message
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[redacted-token]",
    )
    .replace(
      /\b(access[_ -]?token|refresh[_ -]?token|api[_ -]?key|publishable[_ -]?key|service[_ -]?role|password|secret)\s*[:=]\s*["']?[^"' \t,;]+/gi,
      "$1=[redacted]",
    )
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 300);
}

export function getSafeSupabaseErrorDetails(
  error: unknown,
): SupabaseErrorDetails {
  if (typeof error !== "object" || error === null) {
    return {
      message: redactDiagnosticMessage(
        typeof error === "string" ? error : "Unknown error",
      ),
    };
  }

  const details = error as Record<string, unknown>;
  const name = typeof details.name === "string" ? details.name : undefined;
  const code = typeof details.code === "string" ? details.code : undefined;
  const status =
    typeof details.status === "number" ? details.status : undefined;
  const rawMessage =
    typeof details.message === "string" ? details.message : "Unknown error";

  return {
    ...(name ? { name } : {}),
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
    message: redactDiagnosticMessage(rawMessage),
  };
}

export function logSupabaseError(context: string, error: unknown): void {
  console.error(
    `[supabase:${context}] ${JSON.stringify(getSafeSupabaseErrorDetails(error))}`,
  );
}
