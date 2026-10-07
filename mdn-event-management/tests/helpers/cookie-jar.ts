/**
 * The auth cookie value the mocked `next/headers` hands to route handlers.
 * Kept free of imports so the `next/headers` mock can load it without cycles.
 */
export const cookieJar: { token?: string } = {};
