import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { isSessionActive, deleteSession } from "./claude-data"
import { promises as fs } from "fs"

describe("isSessionActive", () => {
  let lstatSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    lstatSpy = vi.spyOn(fs, "lstat")
  })

  afterEach(() => {
    lstatSpy.mockRestore()
  })

  it("returns true for recently modified file", async () => {
    lstatSpy.mockResolvedValue({
      isFile: () => true,
      mtime: new Date(Date.now() - 60_000),
    } as Awaited<ReturnType<typeof fs.lstat>>)

    const result = await isSessionActive("/some/path.jsonl")
    expect(result).toBe(true)
  })

  it("returns false for old file", async () => {
    lstatSpy.mockResolvedValue({
      isFile: () => true,
      mtime: new Date(Date.now() - 10 * 60_000),
    } as Awaited<ReturnType<typeof fs.lstat>>)

    const result = await isSessionActive("/some/path.jsonl")
    expect(result).toBe(false)
  })

  it("returns false for non-existent file", async () => {
    lstatSpy.mockRejectedValue(new Error("ENOENT"))

    const result = await isSessionActive("/some/path.jsonl")
    expect(result).toBe(false)
  })

  it("respects custom threshold", async () => {
    lstatSpy.mockResolvedValue({
      isFile: () => true,
      mtime: new Date(Date.now() - 2 * 60_000),
    } as Awaited<ReturnType<typeof fs.lstat>>)

    const result = await isSessionActive("/some/path.jsonl", 5 * 60_000)
    expect(result).toBe(true)
  })

  it("returns false for symlink (not a regular file)", async () => {
    lstatSpy.mockResolvedValue({
      isFile: () => false,
      isSymbolicLink: () => true,
      mtime: new Date(Date.now() - 60_000),
    } as Awaited<ReturnType<typeof fs.lstat>>)

    const result = await isSessionActive("/some/path.jsonl")
    expect(result).toBe(false)
  })
})

describe("deleteSession", () => {
  let lstatSpy: ReturnType<typeof vi.spyOn>
  let unlinkSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    lstatSpy = vi.spyOn(fs, "lstat")
    unlinkSpy = vi.spyOn(fs, "unlink")
  })

  afterEach(() => {
    lstatSpy.mockRestore()
    unlinkSpy.mockRestore()
  })

  it("returns success true for valid inactive session", async () => {
    lstatSpy.mockResolvedValue({
      isFile: () => true,
      mtime: new Date(Date.now() - 10 * 60_000),
    } as Awaited<ReturnType<typeof fs.lstat>>)
    unlinkSpy.mockResolvedValue(undefined)

    const result = await deleteSession("valid-project", "session.jsonl")
    expect(result.success).toBe(true)
    expect(unlinkSpy).toHaveBeenCalledTimes(1)
  })

  it("returns active error for recently modified session", async () => {
    lstatSpy.mockResolvedValue({
      isFile: () => true,
      mtime: new Date(Date.now() - 60_000),
    } as Awaited<ReturnType<typeof fs.lstat>>)

    const result = await deleteSession("valid-project", "session.jsonl")
    expect(result.success).toBe(false)
    expect(result.error).toBe("active")
    expect(unlinkSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for invalid projectId", async () => {
    const result = await deleteSession("../../../etc/passwd", "session.jsonl")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(unlinkSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for invalid sessionId", async () => {
    const result = await deleteSession("valid-project", "../../../etc/passwd")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(unlinkSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for non-jsonl sessionId", async () => {
    const result = await deleteSession("valid-project", "malicious.txt")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(unlinkSpy).not.toHaveBeenCalled()
  })

  it("returns not_found for symlink", async () => {
    lstatSpy.mockResolvedValue({
      isFile: () => false,
      isSymbolicLink: () => true,
      mtime: new Date(Date.now() - 10 * 60_000),
    } as Awaited<ReturnType<typeof fs.lstat>>)

    const result = await deleteSession("valid-project", "session.jsonl")
    expect(result.success).toBe(false)
    expect(result.error).toBe("not_found")
    expect(unlinkSpy).not.toHaveBeenCalled()
  })
})
