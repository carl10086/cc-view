import { FolderOpen } from "lucide-react"
import { ProjectCard } from "./project-card"
import type { ProjectInfo } from "@/types/claude"

interface ProjectListProps {
  projects: ProjectInfo[]
}

export function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpen className="mb-4 h-12 w-12 text-neutral-400" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          No projects yet
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Start using Claude Code to see your projects here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
