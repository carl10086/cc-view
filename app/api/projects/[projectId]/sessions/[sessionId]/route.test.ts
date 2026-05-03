import { describe, it, expect, vi } from "vitest"
import { DELETE } from "./route"

vi.mock("@/lib/claude-data", () => ({
  deleteSession: vi.fn(),
}))

import { deleteSession } from "@/lib/claude-data"

const mockDeleteSession = vi.mocked(deleteSession)

function createRequest(projectId: string, sessionId: string): Request {
  return new Request(
    `http://localhost:3000/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`
  )
}

function createParams(projectId: string, sessionId: string): Promise<{ projectId: string; sessionId: string }> {
  return Promise.resolve({ projectId, sessionId })
}

describe("DELETE /api/projects/[projectId]/sessions/[sessionId]", () => {
  it("returns 204 when deleteSession succeeds", async () => {
    mockDeleteSession.mockResolvedValue({ success: true })

    const response = await DELETE(createRequest("test-project", "session.jsonl"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(response.status).toBe(204)
    expect(mockDeleteSession).toHaveBeenCalledWith("test-project", "session.jsonl")
  })

  it("returns 404 when deleteSession returns not_found", async () => {
    mockDeleteSession.mockResolvedValue({ success: false, error: "not_found" })

    const response = await DELETE(createRequest("non-existent", "session.jsonl"), {
      params: createParams("non-existent", "session.jsonl"),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Session not found")
  })

  it("returns 409 when deleteSession returns active", async () => {
    mockDeleteSession.mockResolvedValue({ success: false, error: "active" })

    const response = await DELETE(createRequest("test-project", "session.jsonl"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("Session is currently active")
  })

  it("returns 500 when deleteSession returns unknown", async () => {
    mockDeleteSession.mockResolvedValue({ success: false, error: "unknown" })

    const response = await DELETE(createRequest("test-project", "session.jsonl"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Failed to delete session")
  })

  it("passes decoded projectId and sessionId", async () => {
    mockDeleteSession.mockResolvedValue({ success: true })

    const id = "test-project"
    const session = "session.jsonl"
    await DELETE(createRequest(id, session), { params: createParams(id, session) })

    expect(mockDeleteSession).toHaveBeenCalledWith("test-project", "session.jsonl")
  })
})
