import { NextResponse } from "next/server"
import { deleteProject } from "@/lib/claude-data"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params

  const success = await deleteProject(projectId)

  if (!success) {
    return NextResponse.json({ error: "Project not found or could not be deleted" }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
