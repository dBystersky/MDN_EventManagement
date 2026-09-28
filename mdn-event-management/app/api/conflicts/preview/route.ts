import { NextResponse } from "next/server";
import {
    previewAllocationConflicts,
    previewEventConflicts,
} from "@/lib/conflictQueries";
import type { Conflict } from "@/lib/conflicts";

/**
 * What an unsaved event or booking *would* clash with.
 *
 * Read-only despite being a POST: the candidate is a whole object, not something
 * that belongs in a query string, and it is not persisted. Drives the live
 * warning in the event form and the allocations dialog, so the user sees the
 * clash before committing to it rather than after.
 */
export async function POST(request: Request) {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "A JSON body is required" }, { status: 400 });
    }

    try {
        const conflicts = await preview(body as Record<string, unknown>);
        if (conflicts === null) {
            return NextResponse.json(
                { error: 'kind must be "event" or "allocation"' },
                { status: 400 },
            );
        }
        return NextResponse.json(conflicts, { status: 200 });
    } catch (error) {
        return NextResponse.json(
            { error: `Failed to preview conflicts: ${error}` },
            { status: 500 },
        );
    }
}

/**
 * An incomplete candidate is not an error — the form asks on every keystroke,
 * long before every field is filled in. Missing pieces simply mean "nothing to
 * check yet", so those cases answer with an empty list.
 */
async function preview(body: Record<string, unknown>): Promise<Conflict[] | null> {
    if (body.kind === "event") {
        const date = new Date(String(body.date));
        const endDate = new Date(String(body.endDate));
        const locationId = Number(body.locationId);
        if (
            Number.isNaN(date.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            !Number.isFinite(locationId)
        ) {
            return [];
        }

        return previewEventConflicts({
            name: body.name == null ? undefined : String(body.name),
            date,
            endDate,
            locationId,
            resourceIds: Array.isArray(body.resourceIds)
                ? body.resourceIds.map(Number).filter(Number.isFinite)
                : undefined,
            excludeEventId:
                body.excludeEventId == null ? undefined : Number(body.excludeEventId),
        });
    }

    if (body.kind === "allocation") {
        const startTime = new Date(String(body.startTime));
        const endTime = new Date(String(body.endTime));
        const resourceId = Number(body.resourceId);
        if (
            Number.isNaN(startTime.getTime()) ||
            Number.isNaN(endTime.getTime()) ||
            !Number.isFinite(resourceId)
        ) {
            return [];
        }

        return previewAllocationConflicts({
            resourceId,
            startTime,
            endTime,
            bookableId: body.bookableId == null ? undefined : Number(body.bookableId),
            excludeAllocationId:
                body.excludeAllocationId == null
                    ? undefined
                    : Number(body.excludeAllocationId),
        });
    }

    return null;
}
