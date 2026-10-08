/**
 * Supabase/Postgrest errors are plain objects with a `message` field, not
 * `Error` instances — `error instanceof Error` is false for them, so a naive
 * check swallows the real message and always falls back to a generic one.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
