import { describe, it, expect } from "vitest"
import { getProjectById } from "./claude-data"

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
