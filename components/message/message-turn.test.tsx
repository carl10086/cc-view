import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MessageTurn } from "./message-turn"
import type { MessageTurn as TurnType } from "@/types/claude"

describe("MessageTurn", () => {
  const mockTurn: TurnType = {
    id: "turn-1",
    user: {
      id: "msg-1",
      type: "user",
      timestamp: new Date("2024-01-01T00:00:00Z"),
      parentUuid: null,
      raw: { message: { role: "user", content: "Hello" } },
    },
    assistant: null,
    metadata: [],
  }

  it("renders without focus styling by default", () => {
    const { container } = render(<MessageTurn turn={mockTurn} />)
    const turnEl = container.firstChild as HTMLElement
    expect(turnEl.classList.contains("border-blue-500")).toBe(false)
  })

  it("renders with focus styling when isFocused", () => {
    const { container } = render(
      <MessageTurn turn={mockTurn} isFocused={true} />
    )
    const turnEl = container.firstChild as HTMLElement
    expect(turnEl.classList.contains("border-blue-500")).toBe(true)
  })

  it("shows focus button when showFocusButton is true", () => {
    render(<MessageTurn turn={mockTurn} showFocusButton={true} />)
    expect(screen.getByTitle("View context")).toBeDefined()
  })

  it("does not show focus button when showFocusButton is false", () => {
    render(<MessageTurn turn={mockTurn} showFocusButton={false} />)
    expect(screen.queryByTitle("View context")).toBeNull()
  })

  it("calls onFocus when focus button clicked", () => {
    const onFocus = vi.fn()
    render(
      <MessageTurn
        turn={mockTurn}
        showFocusButton={true}
        onFocus={onFocus}
      />
    )
    const button = screen.getByTitle("View context")
    fireEvent.click(button)
    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
