import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { createRef } from "react"
import { MessageStream } from "./message-stream"
import type { MessageStreamHandle } from "./message-stream"
import type { SessionMessage } from "@/types/claude"

describe("MessageStream scrollToMessage", () => {
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
      type: "attachment",
      timestamp: new Date("2024-01-01T00:00:01Z"),
      parentUuid: "msg-1",
      raw: { attachment: { type: "hook_success", hookName: "SessionStart" } },
    },
    {
      id: "msg-3",
      type: "assistant",
      timestamp: new Date("2024-01-01T00:01:00Z"),
      parentUuid: "msg-1",
      raw: { message: { role: "assistant", content: "Hi" } },
    },
  ]

  it("exposes scrollToMessage via ref", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={mockMessages} />)
    expect(ref.current).toBeDefined()
    expect(typeof ref.current?.scrollToMessage).toBe("function")
  })

  it("scrollToMessage does not throw for valid messageId", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={mockMessages} />)
    expect(() => ref.current?.scrollToMessage("msg-2")).not.toThrow()
  })

  it("scrollToMessage does not throw for invalid messageId", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={mockMessages} />)
    expect(() => ref.current?.scrollToMessage("non-existent")).not.toThrow()
  })
})
