import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import { createRef } from "react"
import { MessageStream } from "./message-stream"
import type { MessageStreamHandle } from "./message-stream"
import type { SessionMessage } from "@/types/claude"

const mockScrollToIndex = vi.fn()
const mockGetVirtualItems = vi.fn(() => [])
const mockGetTotalSize = vi.fn(() => 0)
const mockMeasureElement = vi.fn()

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(() => ({
    scrollToIndex: mockScrollToIndex,
    getVirtualItems: mockGetVirtualItems,
    getTotalSize: mockGetTotalSize,
    measureElement: mockMeasureElement,
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function withKind(message: Omit<SessionMessage, "kind" | "filterType">): SessionMessage {
  const kind = message.type === "user"
    ? "user"
    : message.type === "assistant"
      ? "assistant"
      : "metadata"
  return {
    ...message,
    kind,
    filterType: kind === "metadata" ? message.type : kind,
  }
}

function makeMessages(): SessionMessage[] {
  return [
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
  ].map(withKind)
}

describe("MessageStream scrollToMessage", () => {
  it("exposes scrollToMessage via ref", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={makeMessages()} />)
    expect(ref.current).toBeDefined()
    expect(typeof ref.current?.scrollToMessage).toBe("function")
  })

  it("calls scrollToIndex with correct index for user message", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={makeMessages()} />)
    ref.current?.scrollToMessage("msg-1")
    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
  })

  it("calls scrollToIndex with correct index for attachment in metadata", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={makeMessages()} />)
    ref.current?.scrollToMessage("msg-2")
    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
  })

  it("calls scrollToIndex with correct index for assistant in events", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={makeMessages()} />)
    ref.current?.scrollToMessage("msg-3")
    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
  })

  it("does not call scrollToIndex for invalid messageId", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={makeMessages()} />)
    ref.current?.scrollToMessage("non-existent")
    expect(mockScrollToIndex).not.toHaveBeenCalled()
  })
})

describe("MessageStream scrollToTop", () => {
  it("calls scrollToIndex(0, start) when turns exist", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={makeMessages()} />)
    ref.current?.scrollToTop()
    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
  })
})

describe("MessageStream scrollToBottom", () => {
  it("calls scrollToIndex with last index and align end", () => {
    const ref = createRef<MessageStreamHandle>()
    render(<MessageStream ref={ref} messages={makeMessages()} />)
    ref.current?.scrollToBottom()
    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: "end" })
  })
})

describe("MessageStream stale closure regression", () => {
  it("uses latest turns after re-render", () => {
    const ref = createRef<MessageStreamHandle>()
    const messagesA = makeMessages()
    const { rerender } = render(<MessageStream ref={ref} messages={messagesA} />)

    // First render: msg-1 is in turn 0
    ref.current?.scrollToMessage("msg-1")
    expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
    mockScrollToIndex.mockClear()

    // Second render: add a new user message, creating a second turn
    const messagesB = [
      ...messagesA,
      withKind({
        id: "msg-4",
        type: "user",
        timestamp: new Date("2024-01-01T00:02:00Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "Second turn" } },
      }),
    ]
    rerender(<MessageStream ref={ref} messages={messagesB} />)

    // msg-4 should be in turn 1 (second user message)
    ref.current?.scrollToMessage("msg-4")
    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(1, { align: "start" })
  })
})
