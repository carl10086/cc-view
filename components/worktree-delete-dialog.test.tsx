import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { WorktreeDeleteDialog } from "./worktree-delete-dialog"
import type { WorktreeInfo } from "@/types/claude"

const mockWorktree: WorktreeInfo = {
  name: "feat-auth",
  sessionCount: 3,
}

describe("WorktreeDeleteDialog", () => {
  it("does not render content when worktree is null", () => {
    render(
      <WorktreeDeleteDialog
        worktree={null}
        projectName="Test Project"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.queryByText("Delete worktree")).toBeNull()
  })

  it("renders worktree name and session count when worktree is provided", () => {
    render(
      <WorktreeDeleteDialog
        worktree={mockWorktree}
        projectName="Test Project"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText("Delete worktree")).toBeTruthy()
    expect(screen.getByText(/feat-auth/)).toBeTruthy()
    expect(screen.getByText(/3 sessions/)).toBeTruthy()
    expect(screen.getByText(/This action cannot be undone./)).toBeTruthy()
  })

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn()
    render(
      <WorktreeDeleteDialog
        worktree={mockWorktree}
        projectName="Test Project"
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
      <WorktreeDeleteDialog
        worktree={mockWorktree}
        projectName="Test Project"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole("button", { name: "Delete", hidden: true })
    fireEvent.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("handles singular session count correctly", () => {
    const singleSessionWt: WorktreeInfo = {
      ...mockWorktree,
      sessionCount: 1,
    }

    render(
      <WorktreeDeleteDialog
        worktree={singleSessionWt}
        projectName="Test Project"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/1 session/)).toBeTruthy()
  })
})
