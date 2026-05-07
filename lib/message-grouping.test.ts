import { describe, it, expect } from "vitest"
import { extractCompactMessages, groupMessagesIntoTurns } from "./message-grouping"
import type { SessionMessage } from "@/types/claude"

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
  ]

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
    ]
    const result = extractCompactMessages(userOnly)
    expect(result.length).toBe(0)
  })
})
