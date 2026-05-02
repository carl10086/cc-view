import { promises as fs } from "fs"
import path from "path"
import os from "os"
import type { ProjectInfo } from "@/types/claude"

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects")

function parseProjectName(dirName: string): string {
  // Remove home directory prefix like -Users-carlyu-
  const withoutPrefix = dirName.replace(/^-Users-[^-]+-/, "")
  // Convert dashes to path separators and get basename
  const pathLike = withoutPrefix.replace(/-/g, "/")
  return path.basename(pathLike) || dirName
}

async function countSessions(projectPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(projectPath)
    let count = 0
    for (const entry of entries) {
      if (entry.endsWith(".jsonl")) {
        count++
      }
    }
    return count
  } catch {
    return 0
  }
}

export async function getProjects(): Promise<ProjectInfo[]> {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    const projects: ProjectInfo[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue
      }

      const projectPath = path.join(PROJECTS_DIR, entry.name)

      try {
        const stat = await fs.stat(projectPath)
        const sessionCount = await countSessions(projectPath)

        projects.push({
          id: entry.name,
          name: parseProjectName(entry.name),
          path: projectPath,
          sessionCount,
          lastModified: stat.mtime,
        })
      } catch {
        // Skip projects that can't be read
        continue
      }
    }

    return projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  } catch {
    return []
  }
}

export async function getProjectById(id: string): Promise<ProjectInfo | null> {
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
      path: projectPath,
      sessionCount,
      lastModified: stat.mtime,
    }
  } catch {
    return null
  }
}
