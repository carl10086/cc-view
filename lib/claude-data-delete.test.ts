import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { isSessionActive, deleteSession } from "./claude-data"
import { promises as fs } from "fs"

describe("isSessionActive", () => {
  let statSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    statSpy = vi.spyOn(fs, "stat")
  })

  afterEach(() => {
    statSpy.mockRestore()
  })

  it("returns true for recently modified file", async () => {
    statSpy.mockResolvedValue({
      mtime: new Date(Date.now() - 60_000),
    } as Awaited<ReturnType<typeof fs.stat>>)

    const result = await isSessionActive("/some/path.jsonl")
    expect(result).toBe(true)
  })

  it("returns false for old file", async () => {
    statSpy.mockResolvedValue({
      mtime: new Date(Date.now() - 10 * 60_000),
    } as Awaited<ReturnType<typeof fs.stat>>)

    const result = await isSessionActive("/some/path.jsonl")
    expect(result).toBe(false)
  })

  it("returns false for non-existent file", async () => {
    statSpy.mockRejectedValue(new Error("ENOENT"))

    const result = await isSessionActive("/some/path.jsonl")
    expect(result).toBe(false)
  })

  it("respects custom threshold", async () => {
    statSpy.mockResolvedValue({
      mtime: new Date(Date.now() - 2 * 60_000),
    } as Awaited<ReturnType<typeof fs.stat>>)

    const result = await isSessionActive("/some/path.jsonl", 5 * 60_000)
    expect(result).toBe(true)
  })
})

describe("deleteSession", () => {
  let statSpy: ReturnType<typeof vi.spyOn>
  let unlinkSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    statSpy = vi.spyOn(fs, "stat")
    unlinkSpy = vi.spyOn(fs, "unlink")
  })

  afterEach(() => {
    statSpy.mockRestore()
    unlinkSpy.mockRestore()
  })

  it("returns success true for valid inactive session", async () => {
    statSpy.mockResolvedValue({
      mtime: new Date(Date.now() - 10 * 60_000),
    } as Awaited<ReturnType<typeof fs.stat>>)
    unlinkSpy.mockResolvedValue(undefined)

    const result = await deleteSession("valid-project", "session.jsonl")
    expect(result.success).toBe(true)
    expect(unlinkSpy).toHaveBeenCalledTimes(1)
  })

  it("returns active error for recently modified session", async () => {
    statSpy.mockResolvedValue({
      mtime: new Date(Date.now() - 60_000),
    } as Awaited<ReturnType<typeof fs.stat>>)

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
})
