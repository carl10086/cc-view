import { describe, it, expect } from "vitest"
import { getProjectById, getSessions, getSessionMessages, deduplicateProjectNames, deleteProject, readSessionPreview } from "./claude-data"
import { extractMessageNavItems, groupMessagesIntoTurns } from "./message-grouping"
import { buildWorktreeProjectId } from "./worktree"
import fs from "fs"
import os from "os"
import path from "path"

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

describe("deleteProject security", () => {
  it("should return false for path traversal with ..", async () => {
    const result = await deleteProject("../../../etc/passwd")
    expect(result).toBe(false)
  })

  it("should return false for absolute paths", async () => {
    const result = await deleteProject("/absolute/path")
    expect(result).toBe(false)
  })

  it("should return false for non-existent project", async () => {
    const result = await deleteProject("non-existent-project-12345")
    expect(result).toBe(false)
  })

  it("should return false for URL encoded path traversal", async () => {
    const result = await deleteProject("%2e%2e%2f%2e%2e%2fetc%2fpasswd")
    expect(result).toBe(false)
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

  it("should support desc order", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) {
      console.log("No sessions found, skipping test")
      return
    }

    const sessionId = sessions[0].id
    const full = await getSessionMessages(projectId, sessionId, 0, 10000)
    if (!full || full.total <= 1) {
      console.log("Session has too few messages, skipping desc order test")
      return
    }

    const ascFirst = await getSessionMessages(projectId, sessionId, 0, 1, "asc")
    const descFirst = await getSessionMessages(projectId, sessionId, 0, 1, "desc")

    expect(ascFirst?.messages.length).toBe(1)
    expect(descFirst?.messages.length).toBe(1)
    expect(ascFirst?.messages[0].id).not.toBe(descFirst?.messages[0].id)
    expect(descFirst?.hasMore).toBe(true)
  })

  it("desc order should return correct pages", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) return

    const sessionId = sessions[0].id
    const full = await getSessionMessages(projectId, sessionId, 0, 10000)
    if (!full || full.total <= 2) return

    const page1 = await getSessionMessages(projectId, sessionId, 0, 1, "desc")
    const page2 = await getSessionMessages(projectId, sessionId, 1, 1, "desc")

    expect(page1?.messages.length).toBe(1)
    expect(page2?.messages.length).toBe(1)
    expect(page1?.messages[0].id).not.toBe(page2?.messages[0].id)
  })

  it("desc first page should equal asc last page", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) return

    const sessionId = sessions[0].id
    const full = await getSessionMessages(projectId, sessionId, 0, 10000)
    if (!full || full.total <= 1) return

    const ascLast = await getSessionMessages(projectId, sessionId, full.total - 1, 1, "asc")
    const descFirst = await getSessionMessages(projectId, sessionId, 0, 1, "desc")

    expect(ascLast?.messages[0].id).toBe(descFirst?.messages[0].id)
  })

  it("should handle empty session file", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) return

    const sessionId = sessions[0].id
    const result = await getSessionMessages(projectId, sessionId, 0, 10)

    expect(result).not.toBeNull()
    if (result) {
      expect(result.total).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.messages)).toBe(true)
    }
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

describe("deduplicateProjectNames", () => {
  it("disambiguates projects with identical fallback names", () => {
    // deduplicateProjectNames imported statically at top of file
    const projects = [
      {
        id: "-Users-carlyu-soft-projects-dm-cc",
        name: "dm/cc",
        sessionCount: 1,
        lastModified: new Date("2026-05-01"),
        worktrees: [],
      },
      {
        id: "-Users-carlyu-soft-projects-coding-agents-dm-cc",
        name: "dm/cc",
        sessionCount: 0,
        lastModified: new Date("2026-05-01"),
        worktrees: [{ name: "feat-tui", sessionCount: 0 }],
      },
    ]

    const result = deduplicateProjectNames(projects)
    const names = result.map((p) => p.name)
    expect(new Set(names).size).toBe(2)
    expect(names).not.toContain("dm/cc")
  })
})

describe("orphaned worktree handling", () => {
  it("should not show duplicate dm/cc entries", async () => {
    const { getProjects } = await import("./claude-data")
    const projects = await getProjects()
    const dmCcNames = projects.filter((p) => p.name === "dm/cc")
    expect(dmCcNames.length).toBeLessThanOrEqual(1)
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

  it("should throw for mainId with ..", () => {
    expect(() => buildWorktreeProjectId("../../../etc/passwd", "wt")).toThrow()
  })

  it("should throw for mainId with /", () => {
    expect(() => buildWorktreeProjectId("/absolute/path", "wt")).toThrow()
  })

  it("should throw for mainId with \\", () => {
    expect(() => buildWorktreeProjectId("C:\\Windows", "wt")).toThrow()
  })

  it("should throw for worktreeName with ..", () => {
    expect(() => buildWorktreeProjectId("project", "../..")).toThrow()
  })

  it("should throw for worktreeName with /", () => {
    expect(() => buildWorktreeProjectId("project", "a/b")).toThrow()
  })

  it("should throw for worktreeName with \\", () => {
    expect(() => buildWorktreeProjectId("project", "a\\b")).toThrow()
  })

  it("should throw for empty mainId", () => {
    expect(() => buildWorktreeProjectId("", "wt")).toThrow()
  })

  it("should throw for empty worktreeName", () => {
    expect(() => buildWorktreeProjectId("project", "")).toThrow()
  })

  it("should throw when mainId contains WORKTREE_MARKER", () => {
    expect(() =>
      buildWorktreeProjectId(
        "project--claude-worktrees-injected",
        "wt"
      )
    ).toThrow()
  })

  it("should throw when worktreeName contains WORKTREE_MARKER", () => {
    expect(() =>
      buildWorktreeProjectId(
        "project",
        "wt--claude-worktrees-injected"
      )
    ).toThrow()
  })

  it("should throw for overly long mainId", () => {
    const longId = "a".repeat(300)
    expect(() => buildWorktreeProjectId(longId, "wt")).toThrow()
  })

  it("should throw for overly long worktreeName", () => {
    const longName = "a".repeat(300)
    expect(() => buildWorktreeProjectId("project", longName)).toThrow()
  })
})

describe("readSessionPreview", () => {
  function createTempJsonl(content: string): string {
    const tmpDir = os.tmpdir()
    const fileName = `test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
    const filePath = path.join(tmpDir, fileName)
    fs.writeFileSync(filePath, content, "utf-8")
    return filePath
  }

  function cleanup(filePath: string) {
    try {
      fs.unlinkSync(filePath)
    } catch {
      // ignore
    }
  }

  it("extracts firstPrompt from user message with string content", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "permission-mode", permissionMode: "default" }) + "\n" +
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello world" } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.firstPrompt).toBe("Hello world")
      expect(result.lineCount).toBe(2)
    } finally {
      cleanup(filePath)
    }
  })

  it("extracts text blocks from array content", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "file-history-snapshot", snapshot: {} }) + "\n" +
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "tool_use", name: "tool" },
            { type: "text", text: "second part" },
          ],
        },
      }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.firstPrompt).toBe("First part second part")
    } finally {
      cleanup(filePath)
    }
  })

  it("returns null firstPrompt when no user message exists", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "permission-mode", permissionMode: "default" }) + "\n" +
      JSON.stringify({ type: "file-history-snapshot", snapshot: {} }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.firstPrompt).toBeNull()
      expect(result.lineCount).toBe(2)
    } finally {
      cleanup(filePath)
    }
  })

  it("truncates firstPrompt longer than 200 chars", async () => {
    const longText = "a".repeat(250)
    const filePath = createTempJsonl(
      JSON.stringify({ type: "user", message: { role: "user", content: longText } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.firstPrompt).not.toBeNull()
      expect(result.firstPrompt!.length).toBeLessThanOrEqual(201) // 200 + "…"
      expect(result.firstPrompt!.endsWith("…")).toBe(true)
    } finally {
      cleanup(filePath)
    }
  })

  it("returns null firstPrompt for empty content", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "user", message: { role: "user", content: "" } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.firstPrompt).toBeNull()
    } finally {
      cleanup(filePath)
    }
  })

  it("returns null firstPrompt for empty array content", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "user", message: { role: "user", content: [] } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.firstPrompt).toBeNull()
    } finally {
      cleanup(filePath)
    }
  })

  it("preserves existing title extraction", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "ai-title", aiTitle: "My Session Title" }) + "\n" +
      JSON.stringify({ type: "user", message: { role: "user", content: "User question here" } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.title).toBe("My Session Title")
      expect(result.firstPrompt).toBe("User question here")
    } finally {
      cleanup(filePath)
    }
  })

  it("handles real session files correctly", async () => {
    const projectId = "-Users-carlyu-soft-projects-cc-view"
    const sessions = await getSessions(projectId)
    if (sessions.length === 0) {
      console.log("No sessions found, skipping real file test")
      return
    }

    const first = sessions[0]
    expect(first).toHaveProperty("firstPrompt")
    // firstPrompt may be null or string depending on session content
    expect(first.firstPrompt === null || typeof first.firstPrompt === "string").toBe(true)
  })

  it("prioritizes custom-title over ai-title", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "ai-title", aiTitle: "AI Generated Title" }) + "\n" +
      JSON.stringify({ type: "custom-title", customTitle: "User Renamed Title" }) + "\n" +
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello world" } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.title).toBe("User Renamed Title")
    } finally {
      cleanup(filePath)
    }
  })

  it("falls back to ai-title when no custom-title", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "ai-title", aiTitle: "AI Generated Title" }) + "\n" +
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello world" } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.title).toBe("AI Generated Title")
    } finally {
      cleanup(filePath)
    }
  })

  it("returns null title when no custom-title and no ai-title", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "permission-mode", permissionMode: "default" }) + "\n" +
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello world" } }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.title).toBeNull()
      expect(result.firstPrompt).toBe("Hello world")
    } finally {
      cleanup(filePath)
    }
  })

  it("nullifies firstPrompt when custom-title exists", async () => {
    const filePath = createTempJsonl(
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello world" } }) + "\n" +
      JSON.stringify({ type: "custom-title", customTitle: "Renamed Session" }) + "\n"
    )

    try {
      const result = await readSessionPreview(filePath)
      expect(result.title).toBe("Renamed Session")
      expect(result.firstPrompt).toBeNull()
    } finally {
      cleanup(filePath)
    }
  })
})

describe("getSessionMessages with real Claude session files", () => {
  const realProjectId = "-Users-carlyu-soft-projects-read"
  const realSessionId = "c2a20ceb-dbb1-4fbf-90f0-b2c587473153.jsonl"
  const realSessionPath = path.join(
    os.homedir(),
    ".claude",
    "projects",
    realProjectId,
    realSessionId
  )

  it.runIf(fs.existsSync(realSessionPath))(
    "keeps real tool_result records out of user turns",
    async () => {
      const result = await getSessionMessages(realProjectId, realSessionId, 0, 60, "asc")
      expect(result).not.toBeNull()

      const messages = result!.messages
      const toolResultMessages = messages.filter((message) => message.kind === "tool-result")

      expect(toolResultMessages.length).toBeGreaterThan(0)
      expect(toolResultMessages.every((message) => message.type === "user")).toBe(true)
      expect(
        toolResultMessages.some((message) =>
          JSON.stringify(message.raw).includes("Network.enable timed out")
        )
      ).toBe(true)

      const turns = groupMessagesIntoTurns(messages)
      const toolResultIdsInUserSlot = new Set(
        turns
          .map((turn) => turn.user)
          .filter((message): message is NonNullable<typeof message> => message !== null)
          .filter((message) => message.kind === "tool-result")
          .map((message) => message.id)
      )

      expect(toolResultIdsInUserSlot.size).toBe(0)
      expect(turns.some((turn) => turn.toolResults.length > 0)).toBe(true)
    }
  )

  const realCompactSessionId = "77b3830c-13cd-4c75-99e1-27dd2cfe9e0f.jsonl"
  const realCompactSessionPath = path.join(
    os.homedir(),
    ".claude",
    "projects",
    realProjectId,
    realCompactSessionId
  )

  it.runIf(fs.existsSync(realCompactSessionPath))(
    "builds navigation from both real user turns and compact boundaries",
    async () => {
      const result = await getSessionMessages(realProjectId, realCompactSessionId, 0, 500, "asc")
      expect(result).not.toBeNull()

      const navItems = extractMessageNavItems(result!.messages)
      const navTypes = new Set(navItems.map((item) => item.type))

      expect(navTypes.has("user-turn")).toBe(true)
      expect(navTypes.has("compact_boundary")).toBe(true)
      expect(navItems.filter((item) => item.type === "tool-result")).toHaveLength(0)
    }
  )
})
