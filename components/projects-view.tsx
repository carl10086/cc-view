"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FilterX } from "lucide-react"
import { filterProjects, sortProjects, parseUrlState } from "@/lib/project-filters"
import { ProjectList } from "./project-list"
import { ProjectsToolbar } from "./projects-toolbar"
import { pluralize } from "@/lib/utils"
import type { ProjectInfo } from "@/types/claude"

interface ProjectsViewProps {
  projects: ProjectInfo[]
}

export function ProjectsView({ projects }: ProjectsViewProps) {
  const searchParams = useSearchParams()

  const state = useMemo(
    () => parseUrlState(searchParams),
    [searchParams]
  )

  const visible = useMemo(
    () => sortProjects(filterProjects(projects, state), state),
    [projects, state]
  )

  const totalLabel = pluralize(projects.length, "project")
  const showAll = visible.length === projects.length
  const filtered = !showAll && projects.length > 0
  const filteredEmpty = projects.length > 0 && visible.length === 0

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Projects
        </h1>
        <p
          className={
            filtered
              ? "mt-1 text-sm text-blue-600 dark:text-blue-400"
              : "mt-1 text-sm text-neutral-500"
          }
        >
          {showAll ? `${totalLabel} found` : `${totalLabel} · ${visible.length} shown`}
        </p>
      </div>
      <ProjectsToolbar urlState={state} />
      {filteredEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FilterX className="mb-4 h-12 w-12 text-neutral-400" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            No projects match your filters
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Try a different search or time range.
          </p>
          <Link
            href="/projects"
            replace
            scroll={false}
            className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <ProjectList projects={visible} />
      )}
    </>
  )
}
