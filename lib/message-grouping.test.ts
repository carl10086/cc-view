import { describe, it, expect } from "vitest"
import {
  extractCompactMessages,
  extractCompactBoundaryMessages,
  extractMessageNavItems,
  extractUserTurnNavItems,
  groupMessagesIntoTurns,
  pairToolCalls,
} from "./message-grouping"
import { normalizeRawSessionMessage } from "./message-semantics"
import type { SessionMessage, SessionMessageKind } from "@/types/claude"

function withKind(message: Omit<SessionMessage, "kind" | "filterType">): SessionMessage {
  const kind: SessionMessageKind = message.type === "user"
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

function makeToolCall(
  id: string,
  toolUseId: string,
  timestamp: string
): SessionMessage {
  return {
    id: `${id}-tool-call-0`,
    type: "assistant",
    kind: "tool-call",
    filterType: "tool-call",
    timestamp: new Date(timestamp),
    parentUuid: null,
    raw: {
      message: {
        role: "assistant",
        content: [
          { type: "tool_use", id: toolUseId, name: "Bash", input: {} },
        ],
      },
    },
  }
}

function makeToolResult(
  id: string,
  toolUseId: string,
  timestamp: string,
  content: unknown = "result"
): SessionMessage {
  return {
    id: `${id}-tool-result-0`,
    type: "user",
    kind: "tool-result",
    filterType: "tool-result",
    timestamp: new Date(timestamp),
    parentUuid: null,
    raw: {
      message: {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUseId, content },
        ],
      },
    },
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
  it("puts assistant, tool-call, and tool-result into events in source order", () => {
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
        raw: { message: { role: "assistant", content: [{ type: "text", text: "Sure" }] } },
      }),
      makeToolCall("call-1", "tool-1", "2024-01-01T00:00:02Z"),
      makeToolResult("result-1", "tool-1", "2024-01-01T00:00:03Z"),
    ]

    const turns = groupMessagesIntoTurns(messages)

    expect(turns).toHaveLength(1)
    expect(turns[0]?.user?.id).toBe("user-1")
    expect(turns[0]?.events.map((m) => m.id)).toEqual([
      "assistant-1",
      "call-1-tool-call-0",
      "result-1-tool-result-0",
    ])
  })

  it("keeps leading tool-result messages out of user slots", () => {
    const messages: SessionMessage[] = [
      makeToolResult("orphan-result", "tool-x", "2024-01-01T00:00:00Z", "orphan"),
    ]

    const turns = groupMessagesIntoTurns(messages)

    expect(turns).toHaveLength(1)
    expect(turns[0]?.user).toBeNull()
    expect(turns[0]?.events.map((m) => m.id)).toEqual(["orphan-result-tool-result-0"])
  })

  it("does not start a new turn for tool-call", () => {
    const messages: SessionMessage[] = [
      withKind({
        id: "user-1",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "Hi" } },
      }),
      makeToolCall("call-1", "tool-1", "2024-01-01T00:00:01Z"),
      makeToolCall("call-2", "tool-2", "2024-01-01T00:00:02Z"),
    ]

    const turns = groupMessagesIntoTurns(messages)

    expect(turns).toHaveLength(1)
    expect(turns[0]?.events).toHaveLength(2)
    expect(turns[0]?.events.map((m) => m.kind)).toEqual(["tool-call", "tool-call"])
  })

  it("groups normalized mixed-content assistant correctly", () => {
    const normalized = normalizeRawSessionMessage(
      {
        uuid: "asst-mix",
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check" },
            { type: "tool_use", id: "tool-1", name: "Read", input: {} },
            { type: "text", text: "Now respond" },
          ],
        },
      },
      0,
      0
    )

    const messages: SessionMessage[] = [
      withKind({
        id: "user-1",
        type: "user",
        timestamp: new Date("2024-01-01T00:00:00Z"),
        parentUuid: null,
        raw: { message: { role: "user", content: "Go" } },
      }),
      ...normalized,
    ]

    const turns = groupMessagesIntoTurns(messages)

    expect(turns).toHaveLength(1)
    expect(turns[0]?.events.map((m) => m.kind)).toEqual([
      "assistant",
      "tool-call",
      "assistant",
    ])
  })
})

describe("pairToolCalls", () => {
  it("pairs by tool_use.id ↔ tool_result.tool_use_id when ids exist", () => {
    const callA = makeToolCall("call-a", "call_1", "2024-01-01T00:00:01Z")
    const callB = makeToolCall("call-b", "call_2", "2024-01-01T00:00:02Z")
    // Results arrive in reverse order — must still pair correctly by id
    const resultB = makeToolResult("res-b", "call_2", "2024-01-01T00:00:03Z", "result for 2")
    const resultA = makeToolResult("res-a", "call_1", "2024-01-01T00:00:04Z", "result for 1")

    const { pairs } = pairToolCalls([callA, callB], [resultB, resultA])

    expect(pairs.size).toBe(2)
    expect(pairs.get("call-a-tool-call-0")?.id).toBe("res-a-tool-result-0")
    expect(pairs.get("call-b-tool-call-0")?.id).toBe("res-b-tool-result-0")
  })

  it("falls back to positional pairing when tool_use_id absent", () => {
    const callNoId: SessionMessage = {
      id: "call-no-id-tool-call-0",
      type: "assistant",
      kind: "tool-call",
      filterType: "tool-call",
      timestamp: null,
      parentUuid: null,
      raw: {
        message: {
          role: "assistant",
          content: [{ type: "tool_use", name: "Bash", input: {} }],
        },
      },
    }
    const resNoId: SessionMessage = {
      id: "res-no-id-tool-result-0",
      type: "user",
      kind: "tool-result",
      filterType: "tool-result",
      timestamp: null,
      parentUuid: null,
      raw: {
        message: {
          role: "user",
          content: [{ type: "tool_result", content: "out" }],
        },
      },
    }

    const { pairs } = pairToolCalls([callNoId], [resNoId])

    expect(pairs.size).toBe(1)
    expect(pairs.get("call-no-id-tool-call-0")?.id).toBe("res-no-id-tool-result-0")
  })

  it("omits unmatched tool-calls from the result map", () => {
    const call = makeToolCall("call-1", "call_1", "2024-01-01T00:00:01Z")
    const unrelated = makeToolResult("res-1", "different_id", "2024-01-01T00:00:02Z")

    const { pairs } = pairToolCalls([call], [unrelated])

    expect(pairs.size).toBe(0)
    expect(pairs.has("call-1-tool-call-0")).toBe(false)
  })

  it("does not reuse a tool-result for multiple tool-calls", () => {
    const callA = makeToolCall("call-a", "shared-id", "2024-01-01T00:00:01Z")
    const callB = makeToolCall("call-b", "shared-id", "2024-01-01T00:00:02Z")
    const result = makeToolResult("res-1", "shared-id", "2024-01-01T00:00:03Z")

    const { pairs } = pairToolCalls([callA, callB], [result])

    expect(pairs.get("call-a-tool-call-0")?.id).toBe("res-1-tool-result-0")
    expect(pairs.has("call-b-tool-call-0")).toBe(false)
  })

  it("leaves tool-call orphan when tool_use.id mismatches tool_result.tool_use_id", () => {
    const call = makeToolCall("call-1", "id-a", "2024-01-01T00:00:01Z")
    const result = makeToolResult("res-1", "id-b", "2024-01-01T00:00:02Z")

    const { pairs, consumedResultIds } = pairToolCalls([call], [result])

    expect(pairs.size).toBe(0)
    expect(pairs.has("call-1-tool-call-0")).toBe(false)
    expect(consumedResultIds.size).toBe(0)
  })
})
