import { NextResponse } from "next/server";
import { listAllConflicts } from "@/lib/conflictQueries";

/**
 * Every clash in the system, in one response.
 *
 * Deliberately not folded into `GET /api/events` and
 * `GET /api/resource-allocations`: those response shapes are consumed by several
 * pages and by the API tests, and a clash spans two rows anyway, so it does not
 * belong to either. Clients fetch this alongside their existing calls and index
 * it by id (`conflictsByEvent` / `conflictsByAllocation` in `lib/conflicts.ts`).
 */
export async function GET() {
  try {
    const conflicts = await listAllConflicts();
    return NextResponse.json(conflicts, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to get conflicts: ${error}` }, { status: 500 });
  }
}
