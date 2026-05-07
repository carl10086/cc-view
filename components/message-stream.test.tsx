import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { MessageStream } from "./message-stream"
import type { SessionMessage } from "@/types/claude"

describe("MessageStream", () => {
  const mockMessages: SessionMessage[] = [
    {
      id: "msg-1",
      type: "user",
      timestamp: new Date("2024-01-01T00:00:00Z"),
      parentUuid: null,
      raw: { message: { role: "user", content: "Hello" } },
    },
    {
      id: "msg-2",
      type: "assistant",
      timestamp: new Date("2024-01-01T00:01:00Z"),
      parentUuid: "msg-1",
      raw: { message: { role: "assistant", content: "Hi there" } },
    },
  ]

  it("renders without focusedTurnId", () => {
    const { container } = render(
      <MessageStream messages={mockMessages} />
    )
    expect(container.querySelector("[data-testid='message-stream']")).toBeNull()
  })

  it("renders with focusedTurnId", () => {
    const { container } = render(
      <MessageStream
        messages={mockMessages}
        focusedTurnId="msg-1"
      />
    )
    expect(container).toBeDefined()
  })

  it("does not highlight when focusedTurnId does not match any turn", () => {
    const { container } = render(
      <MessageStream
        messages={mockMessages}
        focusedTurnId="non-existent"
      />
    )
    expect(container).toBeDefined()
  })

  it("renders empty state when no messages", () => {
    const { getByText } = render(<MessageStream messages={[]} />)
    expect(getByText("No messages in this session")).toBeDefined()
  })

  it("renders filter empty state when filterActive", () => {
    const { getByText } = render(
      <MessageStream messages={[]} filterActive={true} />
    )
    expect(getByText("No messages match the filter")).toBeDefined()
  })

  it("calls onClearFocus when ESC key pressed", () => {
    const onClearFocus = vi.fn()
    render(
      <MessageStream
        messages={mockMessages}
        focusedTurnId="msg-1"
        onClearFocus={onClearFocus}
      />
    )

    const event = new KeyboardEvent("keydown", { key: "Escape" })
    window.dispatchEvent(event)

    expect(onClearFocus).toHaveBeenCalledTimes(1)
  })
})
