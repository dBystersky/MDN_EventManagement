/**
 * A failed API call. The message is the server's `error`, exactly as before, so
 * `String(err)` banners read the same; `fieldErrors` is set when the server
 * rejected particular fields, for the form to show under each one.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function apiJson(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      json?.error || `${method} ${path} failed (${res.status})`,
      res.status,
      json?.fieldErrors ?? {},
    );
  }
  return json;
}
