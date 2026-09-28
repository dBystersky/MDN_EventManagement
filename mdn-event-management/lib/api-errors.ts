/**
 * Telling "the caller sent something invalid" apart from "the server broke".
 *
 * The lib layer throws plain `Error`s for bad input, and the route handlers were
 * each sniffing the message with their own inline regex (`/subtasks/` in
 * `app/api/events/route.ts`). One list instead, so a new validation message is
 * added in a single place and every route agrees on the status code.
 */

import { Prisma } from "@/generated/prisma/client";

const BAD_REQUEST_MESSAGES: readonly RegExp[] = [
    /subtasks/,
    /must be after/,
    /must be valid dates/,
    /must not be negative/,
    /were not found/,
];

/**
 * True when this error should become a 400 rather than a 500.
 *
 * Prisma's own errors are excluded even though some of their messages would
 * match: they carry codes the routes map themselves (P2025 → 404), and matching
 * on prose here would steal those cases.
 */
export function isBadRequest(error: unknown): error is Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) return false;
    return (
        error instanceof Error &&
        BAD_REQUEST_MESSAGES.some((pattern) => pattern.test(error.message))
    );
}
