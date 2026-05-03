import { promises as fs, statSync } from "fs"
import path from "path"
import os from "os"
import { WORKTREE_MARKER } from "./worktree"
import type { ProjectInfo, SessionInfo, SessionMessage, WorktreeInfo } from "@/types/claude"

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects")

function isValidProjectId(id: string): boolean {
  if (id.includes("..") || path.isAbsolute(id)) {
    return false
  }
  const resolved = path.resolve(PROJECTS_DIR, id)
  return resolved.startsWith(PROJECTS_DIR + path.sep)
}

function decodeProjectPath(encodedName: string): string | null {
  const afterPrefix = encodedName.replace(/^-Users-[^-]+-/, "")
  if (!afterPrefix) return null

  const segments = afterPrefix.split("-")
  const n = segments.length - 1

  // Most common case: all dashes are path separators
  const allSlash = segments.join("/")
  const allSlashPath = path.join(os.homedir(), allSlash)
  try {
    if (statSync(allSlashPath).isDirectory()) {
      return allSlashPath
    }
  } catch {
    // fall through to brute force
  }

  // Limit combinations to avoid exponential blow-up on deep paths
  const MAX_SEGMENTS = 10
  if (n > MAX_SEGMENTS) return null

  // Try all combinations of keeping "-" vs replacing with "/"
  for (let mask = 0; mask < 1 << n; mask++) {
    let candidate = segments[0]
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        candidate += "/" + segments[i + 1]
      } else {
        candidate += "-" + segments[i + 1]
      }
    }

    const fullPath = path.join(os.homedir(), candidate)
    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        return fullPath
      }
    } catch {
      // path doesn't exist
    }
  }

  return null
}

function parseProjectName(dirName: string): string {
  const realPath = decodeProjectPath(dirName)
  if (realPath) {
    return path.basename(realPath)
  }

  // Fallback: show last two segments for disambiguation
  let withoutPrefix = dirName.replace(/^-Users-[^-]+-/, "")
  // Handle hidden directories encoded as `--name` (e.g. `~/.claude`)
  if (withoutPrefix.startsWith("-")) {
    withoutPrefix = withoutPrefix.slice(1)
  }
  const parts = withoutPrefix.split("-").filter((s) => s.length > 0)
  if (parts.length >= 2) {
    return parts.slice(-2).join("/")
  }
  return withoutPrefix || dirName
}

export function deduplicateProjectNames(projects: ProjectInfo[]): ProjectInfo[] {
  // Group by current name
  const groups = new Map<string, ProjectInfo[]>()
  for (const p of projects) {
    const group = groups.get(p.name) || []
    group.push(p)
    groups.set(p.name, group)
  }

  const nameOverrides = new Map<string, string>()

  // For each duplicate group, add more path segments until unique
  for (const [, group] of groups) {
    if (group.length < 2) continue

    // Get real filesystem paths for disambiguation
    const withPaths = group.map((p) => {
      const realPath = decodeProjectPath(p.id)
      if (realPath) {
        const segments = realPath.split(path.sep).filter((s) => s.length > 0)
        return { id: p.id, segments }
      }
      // Fallback: use encoded id segments
      let afterPrefix = p.id.replace(/^-Users-[^-]+-/, "")
      if (afterPrefix.startsWith("-")) {
        afterPrefix = afterPrefix.slice(1)
      }
      const segments = afterPrefix.split("-").filter((s) => s.length > 0)
      return { id: p.id, segments }
    })

    // Find minimum segments needed for uniqueness
    let numSegments = 2
    const maxSegments = Math.max(...withPaths.map((w) => w.segments.length))

    while (numSegments <= maxSegments) {
      const seen = new Set<string>()
      let allUnique = true

      for (const { segments } of withPaths) {
        const candidate = segments.slice(-numSegments).join("/")
        if (seen.has(candidate)) {
          allUnique = false
          break
        }
        seen.add(candidate)
      }

      if (allUnique) break
      numSegments++
    }

    // Store overrides instead of mutating
    for (const { id, segments } of withPaths) {
      const newName = segments.slice(-numSegments).join("/")
      if (newName) nameOverrides.set(id, newName)
    }
  }

  // Apply overrides immutably
  return projects.map((p) => {
    const override = nameOverrides.get(p.id)
    return override && override !== p.name
      ? { ...p, name: override }
      : p
  })
}

function parseWorktree(
  dirName: string
): { mainId: string; name: string } | null {
  const idx = dirName.indexOf(WORKTREE_MARKER)
  if (idx === -1) return null
  return {
    mainId: dirName.slice(0, idx),
    name: dirName.slice(idx + WORKTREE_MARKER.length),
  }
}

async function countSessions(projectPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(projectPath)
    return entries.filter((entry) => entry.endsWith(".jsonl")).length
  } catch {
    return 0
  }
}

interface ProjectData {
  stat?: { mtime: Date }
  sessionCount: number
  worktrees: WorktreeInfo[]
}

export async function getProjects(): Promise<ProjectInfo[]> {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    const projects = new Map<string, ProjectData>()

    // First pass: main projects
    const mainEntries = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith(".") && !parseWorktree(e.name)
    )

    await Promise.all(
      mainEntries.map(async (entry) => {
        const projectPath = path.join(PROJECTS_DIR, entry.name)
        try {
          const [stat, sessionCount] = await Promise.all([
            fs.stat(projectPath),
            countSessions(projectPath),
          ])
          projects.set(entry.name, { stat, sessionCount, worktrees: [] })
        } catch {
          // ignore unreadable directories
        }
      })
    )

    // Second pass: worktrees
    const worktreeEntries = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith(".") && parseWorktree(e.name)
    )

    await Promise.all(
      worktreeEntries.map(async (entry) => {
        const wt = parseWorktree(entry.name)!
        const projectPath = path.join(PROJECTS_DIR, entry.name)
        try {
          const [stat, sessionCount] = await Promise.all([
            fs.stat(projectPath),
            countSessions(projectPath),
          ])

          let main = projects.get(wt.mainId)
          if (!main) {
            // Check if main project directory actually exists
            try {
              const mainStat = await fs.stat(path.join(PROJECTS_DIR, wt.mainId))
              if (!mainStat.isDirectory()) throw new Error("not a directory")
            } catch {
              // Orphaned worktree: treat as standalone project using worktree dir name
              main = { sessionCount: 0, worktrees: [] }
              projects.set(entry.name, main)
            }
            if (!main) {
              main = { sessionCount: 0, worktrees: [] }
              projects.set(wt.mainId, main)
            }
          }

          main.worktrees.push({ name: wt.name, sessionCount })
          main.sessionCount += sessionCount

          if (!main.stat || stat.mtime > main.stat.mtime) {
            main.stat = stat
          }
        } catch {
          // ignore unreadable worktrees
        }
      })
    )

    const result: ProjectInfo[] = []
    for (const [id, data] of projects) {
      if (!data.stat) continue
      result.push({
        id,
        name: parseProjectName(id),
        sessionCount: data.sessionCount,
        lastModified: data.stat.mtime,
        worktrees: data.worktrees.sort((a, b) => b.sessionCount - a.sessionCount),
      })
    }

    const deduped = deduplicateProjectNames(result)

    return deduped.sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
    )
  } catch {
    return []
  }
}

export async function getProjectById(
  id: string
): Promise<ProjectInfo | null> {
  if (!isValidProjectId(id)) {
    return null
  }

  try {
    const projectPath = path.join(PROJECTS_DIR, id)
    const stat = await fs.stat(projectPath)

    if (!stat.isDirectory()) {
      return null
    }

    const sessionCount = await countSessions(projectPath)

    // Find associated worktrees
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    const worktrees: WorktreeInfo[] = []
    let totalSessionCount = sessionCount

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue
      const wt = parseWorktree(entry.name)
      if (wt && wt.mainId === id) {
        const wtPath = path.join(PROJECTS_DIR, entry.name)
        try {
          const wtSessionCount = await countSessions(wtPath)
          worktrees.push({ name: wt.name, sessionCount: wtSessionCount })
          totalSessionCount += wtSessionCount
        } catch {
          // ignore unreadable worktrees
        }
      }
    }

    return {
      id,
      name: parseProjectName(id),
      sessionCount: totalSessionCount,
      lastModified: stat.mtime,
      worktrees,
    }
  } catch {
    return null
  }
}

export async function deleteProject(projectId: string): Promise<boolean> {
  if (!isValidProjectId(projectId)) {
    return false
  }

  const projectPath = path.join(PROJECTS_DIR, projectId)

  try {
    const stat = await fs.stat(projectPath)
    if (!stat.isDirectory()) {
      return false
    }
  } catch {
    return false
  }

  try {
    await fs.rm(projectPath, { recursive: true, force: true })

    // Delete associated worktrees
    const entries = await fs.readdir(PROJECTS_DIR)
    const worktreeDeletions = entries
      .map((entry) => ({ entry, wt: parseWorktree(entry) }))
      .filter(({ wt }) => wt && wt.mainId === projectId)
      .map(({ entry }) => {
        const wtPath = path.join(PROJECTS_DIR, entry)
        return fs.rm(wtPath, { recursive: true, force: true })
      })
    await Promise.all(worktreeDeletions)

    return true
  } catch {
    return false
  }
}

export async function cleanupEmptySessions(
  projectId: string
): Promise<{ deletedSessions: number; deletedWorktrees: number }> {
  if (!isValidProjectId(projectId)) {
    throw new Error("Invalid project ID")
  }

  let deletedSessions = 0
  let deletedWorktrees = 0
  const projectPath = path.join(PROJECTS_DIR, projectId)

  // Step 1: Clean main directory
  try {
    const entries = await fs.readdir(projectPath)
    const jsonlFiles = entries.filter((e) => e.endsWith(".jsonl"))

    await Promise.all(
      jsonlFiles.map(async (fileName) => {
        const filePath = path.join(projectPath, fileName)
        try {
          const meta = await readSessionMeta(filePath)
          if (meta.lineCount === 0) {
            await fs.unlink(filePath)
            deletedSessions++
          }
        } catch {
          // skip unreadable files
        }
      })
    )
  } catch {
    // ignore directory read errors
  }

  // Step 2: Clean worktrees
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    const worktreeEntries = entries.filter(
      (e) =>
        e.isDirectory() &&
        !e.name.startsWith(".") &&
        parseWorktree(e.name)?.mainId === projectId
    )

    await Promise.all(
      worktreeEntries.map(async (entry) => {
        const wtPath = path.join(PROJECTS_DIR, entry.name)

        try {
          const wtEntries = await fs.readdir(wtPath)
          const jsonlFiles = wtEntries.filter((e) => e.endsWith(".jsonl"))

          await Promise.all(
            jsonlFiles.map(async (fileName) => {
              const filePath = path.join(wtPath, fileName)
              try {
                const meta = await readSessionMeta(filePath)
                if (meta.lineCount === 0) {
                  await fs.unlink(filePath)
                  deletedSessions++
                }
              } catch {
                // skip unreadable files
              }
            })
          )

          // Check if worktree has any remaining .jsonl files
          const remaining = await fs.readdir(wtPath)
          const remainingJsonl = remaining.filter((e) => e.endsWith(".jsonl"))
          if (remainingJsonl.length === 0) {
            await fs.rm(wtPath, { recursive: true, force: true })
            deletedWorktrees++
          }
        } catch {
          // ignore worktree errors
        }
      })
    )
  } catch {
    // ignore directory read errors
  }

  return { deletedSessions, deletedWorktrees }
}

export async function readSessionMeta(
  filePath: string
): Promise<{ title: string | null; lineCount: number }> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    const lines = content.split("\n")
    let title: string | null = null
    let lineCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.length === 0) continue
      lineCount++

      if (!title && i < 100) {
        try {
          const obj = JSON.parse(line)
          if (obj.type === "ai-title" && obj.aiTitle) {
            title = obj.aiTitle
          }
        } catch {
          // skip invalid lines
        }
      }
    }

    return { title, lineCount }
  } catch {
    return { title: null, lineCount: 0 }
  }
}

export async function getSessions(projectId: string): Promise<SessionInfo[]> {
  if (!isValidProjectId(projectId)) {
    return []
  }

  const projectPath = path.join(PROJECTS_DIR, projectId)

  try {
    const entries = await fs.readdir(projectPath)
    const jsonlFiles = entries.filter((entry) => entry.endsWith(".jsonl"))

    const sessions = await Promise.all(
      jsonlFiles.map(async (fileName) => {
        const filePath = path.join(projectPath, fileName)
        try {
          const [stat, meta] = await Promise.all([
            fs.stat(filePath),
            readSessionMeta(filePath),
          ])

          return {
            id: fileName,
            title: meta.title,
            messageCount: meta.lineCount,
            lastModified: stat.mtime,
          }
        } catch {
          return null
        }
      })
    )

    return sessions
      .filter((s): s is SessionInfo => s !== null)
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  } catch {
    return []
  }
}

function isValidSessionId(id: string): boolean {
  if (!id.endsWith(".jsonl")) return false
  if (id.includes("..") || id.includes("/") || id.includes("\\")) return false
  return true
}

export async function getSessionMessages(
  projectId: string,
  sessionId: string,
  offset = 0,
  limit = 1000
): Promise<{
  title: string | null
  messages: SessionMessage[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
} | null> {
  if (!isValidProjectId(projectId) || !isValidSessionId(sessionId)) {
    return null
  }

  const filePath = path.join(PROJECTS_DIR, projectId, sessionId)

  try {
    const content = await fs.readFile(filePath, "utf-8")
    const lines = content.split("\n")
    const messages: SessionMessage[] = []
    let title: string | null = null
    let total = 0

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const trimmed = lines[lineIdx].trim()
      if (trimmed.length === 0) continue

      total++

      // Skip JSON parsing for lines outside the requested page
      const messageIdx = total - 1
      const inRange = messageIdx >= offset && messageIdx < offset + limit
      if (!inRange) {
        // Still need to extract title from first 100 lines
        if (!title && lineIdx < 100) {
          try {
            const obj = JSON.parse(trimmed)
            if (obj.type === "ai-title" && obj.aiTitle) {
              title = obj.aiTitle
            }
          } catch {
            // skip invalid lines
          }
        }
        continue
      }

      try {
        const obj = JSON.parse(trimmed)

        if (obj.type === "ai-title" && obj.aiTitle && !title) {
          title = obj.aiTitle
        }

        messages.push({
          id: obj.uuid ? `${obj.uuid}-${messageIdx}` : `${messageIdx}`,
          type: obj.type || "unknown",
          timestamp: obj.timestamp ? new Date(obj.timestamp) : null,
          parentUuid: obj.parentUuid || null,
          raw: obj,
        })
      } catch {
        // skip invalid lines
      }
    }

    const hasMore = offset + limit < total

    return {
      title,
      messages,
      total,
      offset,
      limit,
      hasMore,
    }
  } catch {
    return null
  }
}
