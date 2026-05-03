import { NextResponse } from "next/server"
import { cleanupEmptySessions } from "@/lib/claude-data"

function isLocalhost(request: Request): boolean {
  const url = new URL(request.url)
  const host = url.hostname
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  if (!isLocalhost(request)) {
    return NextResponse.json(
      { error: "Cleanup is only available from localhost" },
      { status: 403 }
    )
  }

  const { projectId } = await params

  try {
    const result = await cleanupEmptySessions(projectId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[cleanup] projectId=${projectId} error:`, message)

    if (message.includes("Invalid project")) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to cleanup empty sessions" },
      { status: 500 }
    )
  }
}
