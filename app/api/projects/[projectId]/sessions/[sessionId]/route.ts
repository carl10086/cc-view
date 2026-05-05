import { NextRequest, NextResponse } from "next/server"
import { getSessionMessages, deleteSession } from "@/lib/claude-data"

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 2000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  const { projectId, sessionId } = await params
  let decodedProjectId: string
  let decodedSessionId: string
  try {
    decodedProjectId = decodeURIComponent(projectId)
    decodedSessionId = decodeURIComponent(sessionId)
  } catch {
    return NextResponse.json({ error: "Invalid project or session ID" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10)
  const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)

  if (Number.isNaN(rawOffset) || Number.isNaN(rawLimit)) {
    return NextResponse.json({ error: "Invalid offset or limit" }, { status: 400 })
  }

  const offset = Math.max(0, rawOffset || 0)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, rawLimit || DEFAULT_LIMIT)
  )

  const result = await getSessionMessages(decodedProjectId, decodedSessionId, offset, limit)

  if (!result) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  return NextResponse.json({
    sessionId: decodedSessionId,
    title: result.title,
    messages: result.messages,
    total: result.total,
    offset: result.offset,
    limit: result.limit,
    hasMore: result.hasMore,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  const { projectId, sessionId } = await params

  let decodedProjectId: string
  let decodedSessionId: string
  try {
    decodedProjectId = decodeURIComponent(projectId)
    decodedSessionId = decodeURIComponent(sessionId)
  } catch {
    return NextResponse.json({ error: "Invalid project or session ID" }, { status: 400 })
  }

  const result = await deleteSession(decodedProjectId, decodedSessionId)

  if (result.success) {
    return new NextResponse(null, { status: 204 })
  }

  switch (result.error) {
    case "not_found":
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    case "active":
      return NextResponse.json({ error: "Session is currently active" }, { status: 409 })
    default:
      return NextResponse.json({ error: "Failed to delete session" }, { status: 500 })
  }
}
