import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { deleteWorktree } from "./claude-data"
import { buildWorktreeProjectId } from "./worktree"
import { promises as fs } from "fs"

describe("deleteWorktree", () => {
  let statSpy: ReturnType<typeof vi.spyOn>
  let rmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    statSpy = vi.spyOn(fs, "stat")
    rmSpy = vi.spyOn(fs, "rm")
  })

  afterEach(() => {
    statSpy.mockRestore()
    rmSpy.mockRestore()
  })

  it("returns success true for valid worktree", async () => {
    statSpy.mockResolvedValue({ isDirectory: () => true } as Awaited<ReturnType<typeof fs.stat>>)
    rmSpy.mockResolvedValue(undefined)

    const result = await deleteWorktree("valid-project", "my-worktree")
    expect(result.success).toBe(true)
    expect(rmSpy).toHaveBeenCalledTimes(1)
  })

  it("returns not_found for non-existent worktree", async () => {
    statSpy.mockRejectedValue(new Error("ENOENT"))

    const result = await deleteWorktree("valid-project", "missing-wt")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(rmSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for invalid projectId with ..", async () => {
    const result = await deleteWorktree("../../../etc/passwd", "wt")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(rmSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for invalid projectId absolute path", async () => {
    const result = await deleteWorktree("/absolute/path", "wt")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(rmSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for invalid worktreeName with ..", async () => {
    const result = await deleteWorktree("project", "../..")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(rmSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for invalid worktreeName with /", async () => {
    const result = await deleteWorktree("project", "a/b")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(rmSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for empty worktreeName", async () => {
    const result = await deleteWorktree("project", "")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(rmSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for worktreeName containing WORKTREE_MARKER", async () => {
    const result = await deleteWorktree("project", "wt--claude-worktrees-injected")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(rmSpy).not.toHaveBeenCalled()
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

  it("should throw for mainId with ..", () => {
    expect(() => buildWorktreeProjectId("../../../etc/passwd", "wt")).toThrow()
  })

  it("should throw for worktreeName with ..", () => {
    expect(() => buildWorktreeProjectId("project", "../..")).toThrow()
  })
})
