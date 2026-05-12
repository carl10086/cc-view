import { describe, it, expect } from "vitest"
import { extractCompactMessages, extractCompactBoundaryMessages, extractMessageNavItems, extractUserTurnNavItems, groupMessagesIntoTurns, pairToolCalls } from "./message-grouping"
import type { SessionMessage } from "@/types/claude"

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

describe("extractCompactMessages", () => {
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
      type: "system",
      timestamp: new Date("2024-01-01T00:00:02Z"),
      parentUuid: null,
      raw: { subtype: "compact" },
    },
    {
      id: "msg-4",
      type: "user",
      timestamp: new Date("2024-01-01T00:01:00Z"),
      parentUuid: null,
      raw: { message: { role: "user", content: "Next" } },
    },
    {
      id: "msg-5",
      type: "attachment",
      timestamp: new Date("2024-01-01T00:01:01Z"),
      parentUuid: "msg-4",
      raw: { attachment: { type: "skill_listing" } },
    },
  ].map(withKind)

  it("returns only non-user/non-assistant messages", () => {
    const result = extractCompactMessages(mockMessages)
    expect(result.length).toBe(3)
    expect(result.every((r: { type: string }) => r.type !== "user" && r.type !== "assistant")).toBe(true)
  })

  it("includes correct turnIndex for each compact message", () => {
    const result = extractCompactMessages(mockMessages)
    // Turns: [user+attachment+system, user+attachment]
    // Turn 0: msg-1 (user), msg-2 (attach), msg-3 (system)
    // Turn 1: msg-4 (user), msg-5 (attach)
    const attach1 = result.find((r: { messageId: string }) => r.messageId === "msg-2")
    const system = result.find((r: { messageId: string }) => r.messageId === "msg-3")
    const attach2 = result.find((r: { messageId: string }) => r.messageId === "msg-5")

    expect(attach1?.turnIndex).toBe(0)
    expect(system?.turnIndex).toBe(0)
    expect(attach2?.turnIndex).toBe(1)
  })

  it("returns empty array when no compact messages", () => {
    const userOnly: SessionMessage[] = [
      {
        id: "msg-1",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: {},
      },
      {
        id: "msg-2",
        type: "assistant",
        timestamp: new Date("2024-01-01T00:01:00Z"),
        parentUuid: "msg-1",
        raw: {},
      },
    ].map(withKind)
    const result = extractCompactMessages(userOnly)
    expect(result.length).toBe(0)
  })
})

describe("extractCompactBoundaryMessages", () => {
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
      type: "system",
      timestamp: new Date("2024-01-01T00:00:01Z"),
      parentUuid: null,
      raw: { subtype: "compact_boundary", compactMetadata: { trigger: "manual", preTokens: 1000 } },
    },
    {
      id: "msg-3",
      type: "system",
      timestamp: new Date("2024-01-01T00:00:02Z"),
      parentUuid: null,
      raw: { subtype: "informational", content: "Some info" },
    },
    {
      id: "msg-4",
      type: "attachment",
      timestamp: new Date("2024-01-01T00:01:00Z"),
      parentUuid: null,
      raw: { attachment: { type: "skill_listing" } },
    },
  ].map(withKind)

  it("returns only compact_boundary system messages", () => {
    const result = extractCompactBoundaryMessages(mockMessages)
    expect(result.length).toBe(1)
    expect(result[0]?.messageId).toBe("msg-2")
    expect(result[0]?.type).toBe("compact_boundary")
  })

  it("returns empty array when no compact_boundary messages", () => {
    const noBoundary: SessionMessage[] = [
      {
        id: "msg-1",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: {},
      },
      {
        id: "msg-2",
        type: "system",
        timestamp: new Date("2024-01-01T00:00:01Z"),
        parentUuid: null,
        raw: { subtype: "informational" },
      },
    ].map(withKind)
    const result = extractCompactBoundaryMessages(noBoundary)
    expect(result.length).toBe(0)
  })
})

describe("extractUserTurnNavItems", () => {
  it("returns real user inputs and skips tool-result messages", () => {
    const messages: SessionMessage[] = [
      withKind({
        id: "user-1",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "First real input" } },
      }),
      {
        id: "tool-result-1",
        type: "user",
        kind: "tool-result",
        filterType: "tool-result",
        timestamp: new Date("2024-01-01T00:00:01Z"),
        parentUuid: "assistant-1",
        raw: {
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "tool-1", content: "Network.enable timed out" }],
          },
        },
      },
      withKind({
        id: "user-2",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:02Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "Second real input" } },
      }),
    ]

    const result = extractUserTurnNavItems(messages)

    expect(result.map((item) => item.messageId)).toEqual(["user-1", "user-2"])
    expect(result.map((item) => item.type)).toEqual(["user-turn", "user-turn"])
    expect(result.map((item) => item.preview)).toEqual([
      "#1 First real input",
      "#2 Second real input",
    ])
  })
})

describe("extractMessageNavItems", () => {
  it("combines user turns and compact boundaries", () => {
    const messages: SessionMessage[] = [
      withKind({
        id: "user-1",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "Before compact" } },
      }),
      withKind({
        id: "compact-1",
        type: "system",
        timestamp: new Date("2024-01-01T00:00:01Z"),
        parentUuid: null,
        raw: { subtype: "compact_boundary", compactMetadata: { trigger: "manual" } },
      }),
      withKind({
        id: "user-2",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:02Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "After compact" } },
      }),
    ]

    const result = extractMessageNavItems(messages)

    expect(result.map((item) => [item.type, item.messageId])).toEqual([
      ["user-turn", "user-1"],
      ["user-turn", "user-2"],
      ["compact_boundary", "compact-1"],
    ])
  })
})

describe("groupMessagesIntoTurns", () => {
  it("does not start a user turn for tool-result messages with raw user type", () => {
    const messages: SessionMessage[] = [
      withKind({
        id: "user-1",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "Inspect this" } },
      }),
      withKind({
        id: "assistant-1",
        type: "assistant",
        timestamp: new Date("2024-01-01T00:00:01Z"),
        parentUuid: "user-1",
        raw: {
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "tool-1", name: "DevTools", input: {} }],
          },
        },
      }),
      {
        id: "tool-result-1",
        type: "user",
        kind: "tool-result",
        filterType: "tool-result",
        timestamp: new Date("2024-01-01T00:00:02Z"),
        parentUuid: "assistant-1",
        raw: {
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "tool-1", content: "Network.enable timed out" }],
          },
        },
      },
    ]

    const turns = groupMessagesIntoTurns(messages)

    expect(turns).toHaveLength(1)
    expect(turns[0]?.user?.id).toBe("user-1")
    expect(turns[0]?.toolResults.map((message) => message.id)).toEqual(["tool-result-1"])
  })

  it("keeps leading tool-result messages out of user slots", () => {
    const messages: SessionMessage[] = [
      {
        id: "tool-result-1",
        type: "user",
        kind: "tool-result",
        filterType: "tool-result",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: {
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "tool-1", content: "orphan" }],
          },
        },
      },
    ]

    const turns = groupMessagesIntoTurns(messages)

    expect(turns).toHaveLength(1)
    expect(turns[0]?.user).toBeNull()
    expect(turns[0]?.toolResults).toHaveLength(1)
  })
})

describe("pairToolCalls", () => {
  it("pairs by tool_use_id when available", () => {
    const toolUses = [
      { type: "tool_use", id: "call_1", name: "Bash", input: {} },
      { type: "tool_use", id: "call_2", name: "Read", input: {} },
    ]
    const toolResults = [
      { type: "tool_result", tool_use_id: "call_2", content: "read result" },
      { type: "tool_result", tool_use_id: "call_1", content: "bash result" },
    ]
    const result = pairToolCalls(toolUses, toolResults)
    expect(result).toHaveLength(2)
    expect(result[0]?.toolUse.id).toBe("call_1")
    expect(result[0]?.toolResult?.content).toBe("bash result")
    expect(result[1]?.toolUse.id).toBe("call_2")
    expect(result[1]?.toolResult?.content).toBe("read result")
  })

  it("falls back to index-based matching when tool_use_id missing", () => {
    const toolUses = [
      { type: "tool_use", name: "Bash", input: {} },
      { type: "tool_use", name: "Read", input: {} },
    ]
    const toolResults = [
      { type: "tool_result", content: "bash result" },
      { type: "tool_result", content: "read result" },
    ]
    const result = pairToolCalls(toolUses, toolResults)
    expect(result).toHaveLength(2)
    expect(result[0]?.toolResult?.content).toBe("bash result")
    expect(result[1]?.toolResult?.content).toBe("read result")
  })

  it("handles unmatched tool_use_id gracefully", () => {
    const toolUses = [
      { type: "tool_use", id: "call_1", name: "Bash", input: {} },
    ]
    const toolResults = [
      { type: "tool_result", tool_use_id: "unknown", content: "orphan" },
    ]
    const result = pairToolCalls(toolUses, toolResults)
    expect(result).toHaveLength(1)
    expect(result[0]?.toolUse.id).toBe("call_1")
    expect(result[0]?.toolResult).toBeUndefined()
  })
})
