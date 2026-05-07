import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MessageNavPanel } from "./message-nav-panel"
import type { CompactMessageNavItem } from "@/lib/message-grouping"

describe("MessageNavPanel", () => {
  const mockItems: CompactMessageNavItem[] = [
    {
      turnIndex: 0,
      messageId: "msg-1",
      type: "attachment",
      preview: "hook_success · SessionStart",
      timestamp: new Date("2024-01-01T00:00:00Z"),
    },
    {
      turnIndex: 0,
      messageId: "msg-2",
      type: "system",
      preview: "compact · 120ms",
      timestamp: new Date("2024-01-01T00:00:01Z"),
    },
    {
      turnIndex: 1,
      messageId: "msg-3",
      type: "attachment",
      preview: "skill_listing",
      timestamp: new Date("2024-01-01T00:01:00Z"),
    },
  ]

  it("renders empty state when no items", () => {
    render(<MessageNavPanel items={[]} onNavigate={vi.fn()} />)
    expect(screen.getByText("No special messages")).toBeDefined()
  })

  it("groups items by type", () => {
    render(<MessageNavPanel items={mockItems} onNavigate={vi.fn()} />)
    expect(screen.getByLabelText("attach · 2")).toBeDefined()
    expect(screen.getByLabelText("system · 1")).toBeDefined()
  })

  it("renders item previews and timestamps", () => {
    render(<MessageNavPanel items={mockItems} onNavigate={vi.fn()} />)
    expect(screen.getByText("hook_success · SessionStart")).toBeDefined()
    expect(screen.getByText("compact · 120ms")).toBeDefined()
  })

  it("calls onNavigate when item clicked", () => {
    const onNavigate = vi.fn()
    render(<MessageNavPanel items={mockItems} onNavigate={onNavigate} />)
    const item = screen.getByText("hook_success · SessionStart")
    fireEvent.click(item)
    expect(onNavigate).toHaveBeenCalledWith("msg-1")
  })

  it("collapses and expands a group", () => {
    render(<MessageNavPanel items={mockItems} onNavigate={vi.fn()} />)
    const groupHeader = screen.getByLabelText("attach · 2")
    fireEvent.click(groupHeader)
    // After collapse, the item should not be visible
    expect(screen.queryByText("hook_success · SessionStart")).toBeNull()
    fireEvent.click(groupHeader)
    expect(screen.getByText("hook_success · SessionStart")).toBeDefined()
  })

  it("truncates long previews to 30 characters", () => {
    const longPreview = "a".repeat(50)
    const items: CompactMessageNavItem[] = [
      {
        turnIndex: 0,
        messageId: "msg-long",
        type: "system",
        preview: longPreview,
        timestamp: null,
      },
    ]
    render(<MessageNavPanel items={items} onNavigate={vi.fn()} />)
    const expected = longPreview.slice(0, 30) + "..."
    expect(screen.getByText(expected)).toBeDefined()
  })

  it("renders disabled hint when provided", () => {
    render(
      <MessageNavPanel
        items={mockItems}
        onNavigate={vi.fn()}
        disabledHint="Load all to enable navigation"
      />
    )
    expect(screen.getByText("Load all to enable navigation")).toBeDefined()
    // Items should not be visible when disabledHint is set
    expect(screen.queryByLabelText("attach · 2")).toBeNull()
  })
})
