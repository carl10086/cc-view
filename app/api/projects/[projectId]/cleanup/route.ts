import { NextResponse } from "next/server"
import { cleanupEmptySessions } from "@/lib/claude-data"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params

  try {
    const result = await cleanupEmptySessions(projectId)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: "Failed to cleanup empty sessions" },
      { status: 500 }
    )
  }
}
