import { NextResponse } from "next/server";
import { listMembers } from "@/lib/members";

export async function GET() {
    try {
        const members = await listMembers();
        return NextResponse.json(members, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get members: ${error}` }, { status: 500 });
    }
}
