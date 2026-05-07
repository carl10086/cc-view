import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FocusContextBar } from "./focus-context-bar"

describe("FocusContextBar", () => {
  it("renders message count", () => {
    render(<FocusContextBar messageCount={42} onClear={vi.fn()} />)
    expect(screen.getByText(/42 messages/)).toBeDefined()
  })

  it("calls onClear when return button clicked", () => {
    const onClear = vi.fn()
    render(<FocusContextBar messageCount={10} onClear={onClear} />)
    const button = screen.getByRole("button", { name: /Return to filter view/i })
    fireEvent.click(button)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
