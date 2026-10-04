/**
 * Telling "the caller sent something invalid" apart from "the server broke".
 *
 * The lib layer throws plain `Error`s for bad input, and the route handlers were
 * each sniffing the message with their own inline regex (`/subtasks/` in
 * `app/api/events/route.ts`). One list instead, so a new validation message is
 * added in a single place and every route agrees on the status code.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { firstError, hasErrors, type FieldErrors } from "@/lib/validation";

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

/**
 * A 400 naming every bad field, or null when the input passed.
 *
 * `error` keeps the one-line summary every existing caller reads; `fieldErrors`
 * is what lets the form put each message under its own field (RTM Req 9).
 *
 *     const invalid = validationFailed(validateEvent(body));
 *     if (invalid) return invalid;
 */
export function validationFailed(errors: FieldErrors): NextResponse | null {
    if (!hasErrors(errors)) return null;
    return NextResponse.json(
        { error: firstError(errors), fieldErrors: errors },
        { status: 400 },
    );
}
