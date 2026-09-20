import { NextResponse } from "next/server";
import { getAuthSession, isGuest } from "@/lib/auth";
import { listMembers } from "@/lib/members";

export async function GET() {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

    try {
        const members = await listMembers();
        return NextResponse.json(members, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get members: ${error}` }, { status: 500 });
    }
}
