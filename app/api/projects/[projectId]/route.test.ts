import { describe, it, expect, vi } from "vitest"
import { DELETE } from "./route"

vi.mock("@/lib/claude-data", () => ({
  deleteProject: vi.fn(),
}))

import { deleteProject } from "@/lib/claude-data"

const mockDeleteProject = vi.mocked(deleteProject)

function createRequest(projectId: string): Request {
  return new Request(`http://localhost:3000/api/projects/${encodeURIComponent(projectId)}`)
}

function createParams(projectId: string): Promise<{ projectId: string }> {
  return Promise.resolve({ projectId })
}

describe("DELETE /api/projects/[projectId]", () => {
  it("returns 204 when deleteProject succeeds", async () => {
    mockDeleteProject.mockResolvedValue(true)

    const response = await DELETE(createRequest("test-project"), {
      params: createParams("test-project"),
    })

    expect(response.status).toBe(204)
    expect(mockDeleteProject).toHaveBeenCalledWith("test-project")
  })

  it("returns 404 when deleteProject returns false", async () => {
    mockDeleteProject.mockResolvedValue(false)

    const response = await DELETE(createRequest("non-existent"), {
      params: createParams("non-existent"),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Project not found or could not be deleted")
  })

  it("passes projectId directly without double decoding", async () => {
    mockDeleteProject.mockResolvedValue(true)

    const id = "test-project"
    await DELETE(createRequest(id), { params: createParams(id) })

    expect(mockDeleteProject).toHaveBeenCalledWith("test-project")
  })
})
