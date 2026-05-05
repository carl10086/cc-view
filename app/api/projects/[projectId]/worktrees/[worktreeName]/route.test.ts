import { describe, it, expect, vi } from "vitest"
import { DELETE } from "./route"

vi.mock("@/lib/claude-data", () => ({
  deleteWorktree: vi.fn(),
}))

import { deleteWorktree } from "@/lib/claude-data"

const mockDeleteWorktree = vi.mocked(deleteWorktree)

function createRequest(projectId: string, worktreeName: string): Request {
  return new Request(
    `http://localhost:3000/api/projects/${encodeURIComponent(projectId)}/worktrees/${encodeURIComponent(worktreeName)}`
  )
}

function createParams(projectId: string, worktreeName: string): Promise<{ projectId: string; worktreeName: string }> {
  return Promise.resolve({ projectId, worktreeName })
}

describe("DELETE /api/projects/[projectId]/worktrees/[worktreeName]", () => {
  it("returns 204 when deleteWorktree succeeds", async () => {
    mockDeleteWorktree.mockResolvedValue({ success: true })

    const response = await DELETE(createRequest("test-project", "my-worktree"), {
      params: createParams("test-project", "my-worktree"),
    })

    expect(response.status).toBe(204)
    expect(mockDeleteWorktree).toHaveBeenCalledWith("test-project", "my-worktree")
  })

  it("returns 404 when deleteWorktree returns not_found", async () => {
    mockDeleteWorktree.mockResolvedValue({ success: false, error: "not_found" })

    const response = await DELETE(createRequest("non-existent", "missing"), {
      params: createParams("non-existent", "missing"),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Worktree not found")
  })

  it("returns 500 when deleteWorktree returns unknown", async () => {
    mockDeleteWorktree.mockResolvedValue({ success: false, error: "unknown" })

    const response = await DELETE(createRequest("test-project", "my-worktree"), {
      params: createParams("test-project", "my-worktree"),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Failed to delete worktree")
  })

  it("passes decoded projectId and worktreeName", async () => {
    mockDeleteWorktree.mockResolvedValue({ success: true })

    const id = "test-project"
    const wt = "my-worktree"
    await DELETE(createRequest(id, wt), { params: createParams(id, wt) })

    expect(mockDeleteWorktree).toHaveBeenCalledWith("test-project", "my-worktree")
  })

  it("returns 400 for malformed URI sequence", async () => {
    mockDeleteWorktree.mockResolvedValue({ success: true })

    const response = await DELETE(
      new Request("http://localhost:3000/api/projects/%ZZ/worktrees/my-worktree"),
      { params: Promise.resolve({ projectId: "%ZZ", worktreeName: "my-worktree" }) }
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Invalid project or worktree name")
  })
})
