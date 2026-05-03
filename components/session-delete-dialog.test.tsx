import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { SessionDeleteDialog } from "./session-delete-dialog"
import type { SessionInfo } from "@/types/claude"

const mockSession: SessionInfo = {
  id: "2025-05-04-session.jsonl",
  title: "Test Session",
  messageCount: 12,
  lastModified: new Date(),
}

describe("SessionDeleteDialog", () => {
  it("does not render content when session is null", () => {
    render(
      <SessionDeleteDialog
        session={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.queryByText("Delete session")).toBeNull()
  })

  it("renders session title and message count when session is provided", () => {
    render(
      <SessionDeleteDialog
        session={mockSession}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText("Delete session")).toBeTruthy()
    expect(screen.getByText(/Test Session/)).toBeTruthy()
    expect(screen.getByText(/12 messages/)).toBeTruthy()
    expect(screen.getByText(/This action cannot be undone./)).toBeTruthy()
  })

  it("renders session id prefix when title is null", () => {
    render(
      <SessionDeleteDialog
        session={{ ...mockSession, title: null }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/2025-05-/)).toBeTruthy()
  })

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn()
    render(
      <SessionDeleteDialog
        session={mockSession}
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
      <SessionDeleteDialog
        session={mockSession}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole("button", { name: "Delete", hidden: true })
    fireEvent.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("handles singular message count correctly", () => {
    const singleMessageSession: SessionInfo = {
      ...mockSession,
      messageCount: 1,
    }

    render(
      <SessionDeleteDialog
        session={singleMessageSession}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/1 message/)).toBeTruthy()
  })
})