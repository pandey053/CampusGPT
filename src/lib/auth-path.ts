export function getSafeRedirectPath(
  value: string | string[] | undefined,
  fallback = "/dashboard",
): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  return value;
}
