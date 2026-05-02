import Link from "next/link"
import { FolderGit2, ArrowRight } from "lucide-react"
import { getProjects } from "@/lib/claude-data"
import { Card, CardContent } from "@/components/ui/card"
import { pluralize } from "@/lib/utils"

export default async function HomePage() {
  const projects = await getProjects()

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-5xl">
          cc-view
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          Browse your Claude Code projects and sessions
        </p>
      </div>

      <div className="mt-12 flex justify-center">
        <Link href="/projects">
          <Card className="w-full max-w-md transition-shadow hover:shadow-md cursor-pointer">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
                  <FolderGit2 className="h-6 w-6 text-neutral-700 dark:text-neutral-300" />
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Projects
                  </p>
                  <p className="text-sm text-neutral-500">
                    {pluralize(projects.length, "project")} found
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-neutral-400" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
