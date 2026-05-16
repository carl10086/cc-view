import { describe, expect, it } from "vitest"
import {
  getMessagePreview,
  normalizeRawSessionMessage,
} from "./message-semantics"

describe("normalizeRawSessionMessage", () => {
  it("classifies string user content as a real user input", () => {
    const raw = {
      uuid: "msg-1",
      type: "user",
      timestamp: "2026-05-12T00:00:00Z",
      message: { role: "user", content: "Hello Claude" },
    }

    const result = normalizeRawSessionMessage(raw, 0, 0)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: "msg-1-0",
      type: "user",
      kind: "user",
      filterType: "user",
      parentUuid: null,
    })
    expect(result[0]?.timestamp).toEqual(new Date("2026-05-12T00:00:00Z"))
    expect(result[0]?.raw).toBe(raw)
  })

  it("classifies text content blocks as real user input", () => {
    const raw = {
      uuid: "msg-2",
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Run the tests" }],
      },
    }

    const result = normalizeRawSessionMessage(raw, 1, 1)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: "msg-2-1",
      kind: "user",
      filterType: "user",
    })
  })

  it("classifies pure tool_result content as tool-result, not user", () => {
    const raw = {
      uuid: "msg-3",
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tool-1",
            content: "command output",
          },
        ],
      },
    }

    const result = normalizeRawSessionMessage(raw, 2, 2)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: "msg-3-2-tool-result-0",
      type: "user",
      kind: "tool-result",
      filterType: "tool-result",
    })
    expect(result[0]?.raw).toBe(raw)
  })

  it("splits mixed text and tool_result content into semantic messages", () => {
    const raw = {
      uuid: "msg-4",
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "text", text: "Please inspect this" },
          {
            type: "tool_result",
            tool_use_id: "tool-2",
            content: "inspection result",
          },
        ],
      },
    }

    const result = normalizeRawSessionMessage(raw, 3, 3)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: "msg-4-3-text-0",
      kind: "user",
      filterType: "user",
    })
    expect(result[1]).toMatchObject({
      id: "msg-4-3-tool-result-1",
      kind: "tool-result",
      filterType: "tool-result",
    })
    // Text-block user messages get their own shallow raw copy with only that block
    const userMessages = result.filter((m) => m.kind === "user")
    expect(userMessages[0]?.raw).not.toBe(raw)
    expect(
      (userMessages[0]?.raw as Record<string, unknown>).message
    ).toMatchObject({
      content: [{ type: "text", text: "Please inspect this" }],
    })
    // Tool-result messages keep the full original raw
    const toolMessages = result.filter((m) => m.kind === "tool-result")
    expect(toolMessages[0]?.raw).toBe(raw)
  })

  it("split user message previews should only contain their own text block", () => {
    const raw = {
      uuid: "msg-mixed",
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "text", text: "First user input" },
          { type: "text", text: "Second user input" },
          {
            type: "tool_result",
            tool_use_id: "tool-1",
            content: "tool output",
          },
        ],
      },
    }

    const result = normalizeRawSessionMessage(raw, 0, 0)

    const userMessages = result.filter((m) => m.kind === "user")
    expect(userMessages).toHaveLength(2)

    // BUG: each user message's preview currently returns ALL text blocks
    // because they share the same full raw object
    expect(getMessagePreview(userMessages[0]!)).toBe("First user input")
    expect(getMessagePreview(userMessages[1]!)).toBe("Second user input")
  })

  it("classifies isMeta user messages as metadata, not real user input", () => {
    const raw = {
      uuid: "msg-meta",
      type: "user",
      isMeta: true,
      message: {
        role: "user",
        content: "Base directory for this skill...",
      },
    }

    const result = normalizeRawSessionMessage(raw, 0, 0)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: "metadata",
      filterType: "user",
    })
  })

  it("classifies assistant and metadata messages", () => {
    const assistant = normalizeRawSessionMessage(
      {
        uuid: "assistant-1",
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "Done" }] },
      },
      4,
      4
    )
    const metadata = normalizeRawSessionMessage(
      { type: "permission-mode", permissionMode: "default" },
      5,
      5
    )

    expect(assistant[0]).toMatchObject({
      kind: "assistant",
      filterType: "assistant",
    })
    expect(metadata[0]).toMatchObject({
      kind: "metadata",
      filterType: "permission-mode",
    })
  })
})

describe("getMessagePreview", () => {
  it("extracts a preview for string and array text content", () => {
    const [stringMessage] = normalizeRawSessionMessage(
      { type: "user", message: { role: "user", content: "Hello world" } },
      0,
      0
    )
    const [arrayMessage] = normalizeRawSessionMessage(
      {
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "second part" },
          ],
        },
      },
      1,
      1
    )

    expect(getMessagePreview(stringMessage!)).toBe("Hello world")
    expect(getMessagePreview(arrayMessage!)).toBe("First part second part")
  })

  it("truncates long previews", () => {
    const [message] = normalizeRawSessionMessage(
      {
        type: "user",
        message: { role: "user", content: "a".repeat(80) },
      },
      0,
      0
    )

    expect(getMessagePreview(message!, 20)).toBe(`${"a".repeat(20)}...`)
  })
})
