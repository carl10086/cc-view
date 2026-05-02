import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { FolderGit2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { pluralize } from "@/lib/utils"
import type { ProjectInfo } from "@/types/claude"

interface ProjectCardProps {
  project: ProjectInfo
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${encodeURIComponent(project.id)}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-neutral-500" />
              <CardTitle className="text-lg">{project.name}</CardTitle>
            </div>
            <Badge variant="secondary">
              {pluralize(project.sessionCount, "session")}
            </Badge>
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
  )
}
