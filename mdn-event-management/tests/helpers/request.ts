/** Builds a `Request` like the one Next passes to a route handler. */
export function jsonRequest(method: string, body?: unknown, url = "http://localhost/api/test") {
  return new Request(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** The second argument of a dynamic route handler, e.g. `params({ taskId: "1" })`. */
export function params<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) };
}

/** Status plus parsed JSON body of a handler response. */
export async function read(response: Response) {
  return { status: response.status, json: await response.json() };
}
