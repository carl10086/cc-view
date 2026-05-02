import { promises as fs } from "fs"
import path from "path"
import os from "os"
import type { ProjectInfo } from "@/types/claude"

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects")

function isValidProjectId(id: string): boolean {
  if (id.includes("..") || path.isAbsolute(id)) {
    return false
  }
  const resolved = path.resolve(PROJECTS_DIR, id)
  return resolved.startsWith(PROJECTS_DIR + path.sep)
}

function parseProjectName(dirName: string): string {
  const withoutPrefix = dirName.replace(/^-Users-[^/]+-/, "")
  const pathLike = withoutPrefix.replace(/-/g, "/")
  return path.basename(pathLike) || dirName
}

async function countSessions(projectPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(projectPath)
    return entries.filter((entry) => entry.endsWith(".jsonl")).length
  } catch {
    return 0
  }
}

export async function getProjects(): Promise<ProjectInfo[]> {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })

    const projectPromises = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry) => {
        const projectPath = path.join(PROJECTS_DIR, entry.name)

        try {
          const [stat, sessionCount] = await Promise.all([
            fs.stat(projectPath),
            countSessions(projectPath),
          ])

          return {
            id: entry.name,
            name: parseProjectName(entry.name),
            sessionCount,
            lastModified: stat.mtime,
          } satisfies ProjectInfo
        } catch {
          return null
        }
      })

    const projects = (await Promise.all(projectPromises)).filter(
      (p): p is ProjectInfo => p !== null
    )

    return projects.sort(
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

    return {
      id,
      name: parseProjectName(id),
      sessionCount,
      lastModified: stat.mtime,
    }
  } catch {
    return null
  }
}
