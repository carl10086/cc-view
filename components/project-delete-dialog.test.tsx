import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { ProjectDeleteDialog } from "./project-delete-dialog"
import type { ProjectInfo } from "@/types/claude"

const mockProject: ProjectInfo = {
  id: "test-project",
  name: "Test Project",
  sessionCount: 5,
  lastModified: new Date(),
  worktrees: [{ name: "wt1", sessionCount: 2 }],
}

describe("ProjectDeleteDialog", () => {
  it("does not render content when project is null", () => {
    render(
      <ProjectDeleteDialog
        project={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.queryByText("Delete project")).toBeNull()
  })

  it("renders project name and session count when project is provided", () => {
    render(
      <ProjectDeleteDialog
        project={mockProject}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText("Delete project")).toBeTruthy()
    expect(screen.getByText(/Test Project/)).toBeTruthy()
    expect(screen.getByText(/5 sessions/)).toBeTruthy()
    expect(screen.getByText(/1 worktree/)).toBeTruthy()
  })

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn()
    render(
      <ProjectDeleteDialog
        project={mockProject}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    const cancelButton = screen.getByRole("button", { name: "Cancel", hidden: true })
    fireEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("calls onConfirm when Delete button is clicked", () => {
    const onConfirm = vi.fn()
    render(
      <ProjectDeleteDialog
        project={mockProject}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole("button", { name: "Delete", hidden: true })
    fireEvent.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("handles singular session count correctly", () => {
    const singleSessionProject: ProjectInfo = {
      ...mockProject,
      sessionCount: 1,
      worktrees: [],
    }

    render(
      <ProjectDeleteDialog
        project={singleSessionProject}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/1 session/)).toBeTruthy()
    expect(screen.queryByText(/worktree/)).toBeNull()
  })
})
