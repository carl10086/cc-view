import { describe, it, expect } from "vitest"
import { getProjectById, getSessions, getSessionMessages } from "./claude-data"
import { buildWorktreeProjectId } from "./worktree"

describe("getProjectById security", () => {
  it("should return null for path traversal with ..", async () => {
    const result = await getProjectById("../../../etc/passwd")
    expect(result).toBeNull()
  })

  it("should return null for absolute paths", async () => {
    const result = await getProjectById("/absolute/path")
    expect(result).toBeNull()
  })

  it("should return null for URL encoded path traversal", async () => {
    const result = await getProjectById("%2e%2e%2f%2e%2e%2fetc%2fpasswd")
    expect(result).toBeNull()
  })

  it("should return null for non-existent directory", async () => {
    const result = await getProjectById("non-existent-project-12345")
    expect(result).toBeNull()
  })
})

describe("getProjects error handling", () => {
  it("should return empty array gracefully", async () => {
    const { getProjects } = await import("./claude-data")
    const result = await getProjects()
    expect(Array.isArray(result)).toBe(true)
  })
})

describe("getSessions security", () => {
  it("should return empty array for path traversal", async () => {
    const result = await getSessions("../../../etc/passwd")
    expect(result).toEqual([])
  })

  it("should return empty array for absolute paths", async () => {
    const result = await getSessions("/absolute/path")
    expect(result).toEqual([])
  })
})

describe("getSessions for real project", () => {
  it("should return sessions array with correct shape", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)

    expect(Array.isArray(sessions)).toBe(true)
    if (sessions.length > 0) {
      const first = sessions[0]
      expect(first).toHaveProperty("id")
      expect(first).toHaveProperty("title")
      expect(first).toHaveProperty("messageCount")
      expect(first).toHaveProperty("lastModified")
      expect(typeof first.messageCount).toBe("number")
      expect(first.lastModified instanceof Date).toBe(true)
    }
  })
})

describe("getSessionMessages security", () => {
  it("should return null for path traversal in projectId", async () => {
    const result = await getSessionMessages("../../../etc/passwd", "session.jsonl")
    expect(result).toBeNull()
  })

  it("should return null for invalid sessionId", async () => {
    const result = await getSessionMessages("valid-project", "../../../etc/passwd")
    expect(result).toBeNull()
  })

  it("should return null for non-jsonl sessionId", async () => {
    const result = await getSessionMessages("valid-project", "malicious.txt")
    expect(result).toBeNull()
  })
})

describe("getSessionMessages pagination", () => {
  it("should respect offset and limit", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) {
      console.log("No sessions found, skipping test")
      return
    }

    const sessionId = sessions[0].id
    const full = await getSessionMessages(projectId, sessionId, 0, 10000)
    if (!full || full.total <= 1) {
      console.log("Session has too few messages, skipping pagination test")
      return
    }

    const page1 = await getSessionMessages(projectId, sessionId, 0, 1)
    const page2 = await getSessionMessages(projectId, sessionId, 1, 1)

    expect(page1?.messages.length).toBe(1)
    expect(page2?.messages.length).toBe(1)
    expect(page1?.messages[0].id).not.toBe(page2?.messages[0].id)
    expect(page1?.hasMore).toBe(true)
  })

  it("should return hasMore=false when reading last page", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) return

    const sessionId = sessions[0].id
    const full = await getSessionMessages(projectId, sessionId)
    if (!full || full.total === 0) return

    const lastPage = await getSessionMessages(
      projectId,
      sessionId,
      Math.max(0, full.total - 1),
      10
    )

    expect(lastPage?.hasMore).toBe(false)
    expect(lastPage?.messages.length).toBeLessThanOrEqual(1)
  })
})

describe("getSessionMessages for real session", () => {
  it("should return messages with correct shape", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) {
      console.log("No sessions found, skipping test")
      return
    }

    const sessionId = sessions[0].id
    const result = await getSessionMessages(projectId, sessionId)

    expect(result).not.toBeNull()
    if (result) {
      expect(result).toHaveProperty("title")
      expect(result).toHaveProperty("messages")
      expect(Array.isArray(result.messages)).toBe(true)

      if (result.messages.length > 0) {
        const first = result.messages[0]
        expect(first).toHaveProperty("id")
        expect(first).toHaveProperty("type")
        expect(first).toHaveProperty("timestamp")
        expect(first).toHaveProperty("parentUuid")
        expect(first).toHaveProperty("raw")
      }
    }
  })
})

describe("worktree support", () => {
  it("should include worktrees array in project", async () => {
    const { getProjects } = await import("./claude-data")
    const projects = await getProjects()

    for (const project of projects) {
      expect(Array.isArray(project.worktrees)).toBe(true)
      expect(project).toHaveProperty("sessionCount")
      // sessionCount should include worktree sessions
      const wtCount = project.worktrees.reduce((sum, w) => sum + w.sessionCount, 0)
      expect(project.sessionCount).toBeGreaterThanOrEqual(wtCount)
    }
  })
})

describe("buildWorktreeProjectId", () => {
  it("should concatenate mainId with worktree marker and name", () => {
    const result = buildWorktreeProjectId(
      "-Users-carlyu-soft-projects-ys-code",
      "command-execution-alignment"
    )
    expect(result).toBe(
      "-Users-carlyu-soft-projects-ys-code--claude-worktrees-command-execution-alignment"
    )
  })

  it("should handle simple names", () => {
    const result = buildWorktreeProjectId("project-a", "fix-bug")
    expect(result).toBe("project-a--claude-worktrees-fix-bug")
  })
})
