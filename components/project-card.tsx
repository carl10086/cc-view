import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { FolderGit2, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { pluralize } from "@/lib/utils"
import type { ProjectInfo } from "@/types/claude"

interface ProjectCardProps {
  project: ProjectInfo
  onDelete?: (project: ProjectInfo) => void
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <div className="group relative">
      <Link href={`/projects/${encodeURIComponent(project.id)}`} className="block">
        <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-neutral-500" />
                <CardTitle className="text-lg">{project.name}</CardTitle>
              </div>
              <div className="flex gap-2">
                {project.worktrees.length > 0 && (
                  <Badge variant="outline">
                    {pluralize(project.worktrees.length, "worktree")}
                  </Badge>
                )}
                <Badge variant="secondary">
                  {pluralize(project.sessionCount, "session")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500">
              Last active{" "}
              {formatDistanceToNow(project.lastModified, { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(project)
          }}
          className="absolute right-2 top-2 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
          aria-label={`Delete project ${project.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
