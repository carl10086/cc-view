import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FolderGit2 } from "lucide-react"
import { getProjectById } from "@/lib/claude-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { pluralize } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface ProjectPageProps {
  params: Promise<{
    projectId: string
  }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params
  const decodedId = decodeURIComponent(projectId)
  const project = await getProjectById(decodedId)

  if (!project) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FolderGit2 className="h-6 w-6 text-neutral-500" />
            <CardTitle className="text-2xl">{project.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Sessions:</span>
            <Badge variant="secondary">
              {pluralize(project.sessionCount, "session")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Last active:</span>
            <span className="text-sm">
              {formatDistanceToNow(project.lastModified, { addSuffix: true })}
            </span>
          </div>
          <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-900">
            <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
              {project.id}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
