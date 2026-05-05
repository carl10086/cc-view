import { NextResponse } from "next/server"
import { deleteWorktree } from "@/lib/claude-data"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; worktreeName: string }> }
) {
  const { projectId, worktreeName } = await params
  let decodedProjectId: string
  let decodedWorktreeName: string
  try {
    decodedProjectId = decodeURIComponent(projectId)
    decodedWorktreeName = decodeURIComponent(worktreeName)
  } catch {
    return NextResponse.json({ error: "Invalid project or worktree name" }, { status: 400 })
  }

  const result = await deleteWorktree(decodedProjectId, decodedWorktreeName)

  if (result.success) {
    return new NextResponse(null, { status: 204 })
  }

  switch (result.error) {
    case "not_found":
      return NextResponse.json({ error: "Worktree not found" }, { status: 404 })
    default:
      return NextResponse.json({ error: "Failed to delete worktree" }, { status: 500 })
  }
}
