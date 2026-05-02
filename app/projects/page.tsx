import { getProjects } from "@/lib/claude-data"
import { ProjectList } from "@/components/project-list"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Projects
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {projects.length} project{projects.length !== 1 ? "s" : ""} found
        </p>
      </div>
      <ProjectList projects={projects} />
    </div>
  )
}
