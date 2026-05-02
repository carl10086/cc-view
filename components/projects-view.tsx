"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
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
    () => parseUrlState(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const visible = useMemo(
    () => sortProjects(filterProjects(projects, state), state),
    [projects, state]
  )

  const totalLabel = pluralize(projects.length, "project")
  const showAll = visible.length === projects.length

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Projects
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {showAll ? `${totalLabel} found` : `${totalLabel} · ${visible.length} shown`}
        </p>
      </div>
      <ProjectsToolbar urlState={state} />
      <ProjectList projects={visible} />
    </>
  )
}
