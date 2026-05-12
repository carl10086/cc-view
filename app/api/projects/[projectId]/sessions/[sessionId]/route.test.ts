import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, DELETE } from "./route"

vi.mock("@/lib/claude-data", () => ({
  getSessionMessages: vi.fn(),
  deleteSession: vi.fn(),
}))

import { getSessionMessages, deleteSession } from "@/lib/claude-data"

const mockGetSessionMessages = vi.mocked(getSessionMessages)
const mockDeleteSession = vi.mocked(deleteSession)

function createRequest(projectId: string, sessionId: string, query?: string): NextRequest {
  const url = `http://localhost:3000/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}${query ? `?${query}` : ""}`
  return new NextRequest(url)
}

function createParams(projectId: string, sessionId: string): Promise<{ projectId: string; sessionId: string }> {
  return Promise.resolve({ projectId, sessionId })
}

describe("GET /api/projects/[projectId]/sessions/[sessionId]", () => {
  beforeEach(() => {
    mockGetSessionMessages.mockReset()
  })

  it("returns session messages with default params", async () => {
    mockGetSessionMessages.mockResolvedValue({
      title: "Test Session",
      messages: [{
        id: "1",
        type: "user",
        kind: "user",
        filterType: "user",
        timestamp: null,
        parentUuid: null,
        raw: { type: "user" },
      }],
      total: 1,
      offset: 0,
      limit: 1000,
      hasMore: false,
    })

    const response = await GET(createRequest("test-project", "session.jsonl"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.title).toBe("Test Session")
    expect(body.messages).toHaveLength(1)
    expect(mockGetSessionMessages).toHaveBeenCalledWith("test-project", "session.jsonl", 0, 1000, "asc")
  })

  it("passes order=desc to getSessionMessages", async () => {
    mockGetSessionMessages.mockResolvedValue({
      title: null,
      messages: [],
      total: 0,
      offset: 0,
      limit: 1000,
      hasMore: false,
    })

    await GET(createRequest("test-project", "session.jsonl", "order=desc"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(mockGetSessionMessages).toHaveBeenCalledWith("test-project", "session.jsonl", 0, 1000, "desc")
  })

  it("normalizes order parameter to lowercase", async () => {
    mockGetSessionMessages.mockResolvedValue({
      title: null,
      messages: [],
      total: 0,
      offset: 0,
      limit: 1000,
      hasMore: false,
    })

    await GET(createRequest("test-project", "session.jsonl", "order=DESC"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(mockGetSessionMessages).toHaveBeenCalledWith("test-project", "session.jsonl", 0, 1000, "desc")
  })

  it("returns 400 for invalid order", async () => {
    const response = await GET(createRequest("test-project", "session.jsonl", "order=invalid"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Invalid order")
  })

  it("returns 400 for invalid offset", async () => {
    const response = await GET(createRequest("test-project", "session.jsonl", "offset=abc"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Invalid offset or limit")
  })

  it("returns 404 when session not found", async () => {
    mockGetSessionMessages.mockResolvedValue(null)

    const response = await GET(createRequest("test-project", "session.jsonl"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Session not found")
  })

  it("clamps limit to MAX_LIMIT", async () => {
    mockGetSessionMessages.mockResolvedValue({
      title: null,
      messages: [],
      total: 0,
      offset: 0,
      limit: 2000,
      hasMore: false,
    })

    await GET(createRequest("test-project", "session.jsonl", "limit=5000"), {
      params: createParams("test-project", "session.jsonl"),
    })

    expect(mockGetSessionMessages).toHaveBeenCalledWith("test-project", "session.jsonl", 0, 2000, "asc")
  })
})

describe("DELETE /api/projects/[projectId]/sessions/[sessionId]", () => {
  beforeEach(() => {
    mockDeleteSession.mockReset()
  })

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

  it("returns 400 for malformed URI sequence", async () => {
    mockDeleteSession.mockResolvedValue({ success: true })

    const response = await DELETE(
      new Request("http://localhost:3000/api/projects/%ZZ/sessions/session.jsonl"),
      { params: Promise.resolve({ projectId: "%ZZ", sessionId: "session.jsonl" }) }
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Invalid project or session ID")
  })
})
