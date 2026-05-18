import type { SessionMessage, SessionMessageKind } from "@/types/claude"

type RawRecord = Record<string, unknown>

export function asRecord(value: unknown): RawRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined
}

function getRawMessage(raw: RawRecord): RawRecord | undefined {
  return asRecord(raw.message)
}

function getBaseMessageFields(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  suffix?: string
): Omit<SessionMessage, "kind" | "filterType"> {
  const uuid = typeof raw.uuid === "string" ? raw.uuid : null
  const baseId = uuid ? `${uuid}-${messageIndex}` : `${lineIndex}`
  const timestamp = typeof raw.timestamp === "string"
    ? new Date(raw.timestamp)
    : null

  return {
    id: suffix ? `${baseId}-${suffix}` : baseId,
    type: typeof raw.type === "string" ? raw.type : "unknown",
    timestamp,
    parentUuid: typeof raw.parentUuid === "string" ? raw.parentUuid : null,
    raw,
  }
}

function buildMessage(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  kind: SessionMessageKind,
  filterType: string,
  suffix?: string
): SessionMessage {
  return {
    ...getBaseMessageFields(raw, lineIndex, messageIndex, suffix),
    kind,
    filterType,
  }
}

function isTextBlock(block: RawRecord): boolean {
  return block.type === "text" && typeof block.text === "string" && block.text.length > 0
}

function isThinkingBlock(block: RawRecord): boolean {
  return block.type === "thinking"
}

function isToolUseBlock(block: RawRecord): boolean {
  return block.type === "tool_use"
}

function isToolResultBlock(block: RawRecord): boolean {
  return block.type === "tool_result"
}

function toRecordBlocks(content: unknown[]): RawRecord[] {
  return content
    .map((block) => asRecord(block))
    .filter((block): block is RawRecord => block !== undefined)
}

function getMetadataFilterType(raw: RawRecord): string {
  return typeof raw.type === "string" ? raw.type : "unknown"
}

function buildUserMessage(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  suffix?: string
): SessionMessage {
  return buildMessage(raw, lineIndex, messageIndex, "user", "user", suffix)
}

function buildToolResultMessage(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  suffix: string
): SessionMessage {
  return buildMessage(
    raw,
    lineIndex,
    messageIndex,
    "tool-result",
    "tool-result",
    suffix
  )
}

function buildAssistantMessage(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  suffix?: string
): SessionMessage {
  return buildMessage(raw, lineIndex, messageIndex, "assistant", "assistant", suffix)
}

function buildToolCallMessage(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  suffix: string
): SessionMessage {
  return buildMessage(raw, lineIndex, messageIndex, "tool-call", "tool-call", suffix)
}

function normalizeAssistantContent(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  content: unknown
): SessionMessage[] {
  if (typeof content === "string" || !Array.isArray(content)) {
    return [buildAssistantMessage(raw, lineIndex, messageIndex)]
  }

  const blocks = toRecordBlocks(content)
  if (blocks.length === 0) {
    return [buildAssistantMessage(raw, lineIndex, messageIndex)]
  }

  const hasToolUse = blocks.some(isToolUseBlock)
  const hasTextOrThinking = blocks.some(
    (b) => isTextBlock(b) || isThinkingBlock(b)
  )

  if (!hasToolUse) {
    return [buildAssistantMessage(raw, lineIndex, messageIndex)]
  }

  if (!hasTextOrThinking) {
    return blocks.flatMap((block, index) => {
      if (isToolUseBlock(block)) {
        return [
          buildToolCallMessage(raw, lineIndex, messageIndex, `tool-call-${index}`),
        ]
      }
      return []
    })
  }

  const out: SessionMessage[] = []
  let segmentBlocks: RawRecord[] = []
  let segmentIndex = 0
  const baseMessage = asRecord(raw.message) ?? {}

  const flushSegment = () => {
    if (segmentBlocks.length === 0) return
    const newRaw = {
      ...raw,
      message: {
        ...baseMessage,
        content: segmentBlocks,
      },
    }
    out.push(
      buildAssistantMessage(newRaw, lineIndex, messageIndex, `assistant-${segmentIndex}`)
    )
    segmentIndex += 1
    segmentBlocks = []
  }

  blocks.forEach((block, index) => {
    if (isTextBlock(block) || isThinkingBlock(block)) {
      segmentBlocks.push(block)
      return
    }
    if (isToolUseBlock(block)) {
      flushSegment()
      out.push(
        buildToolCallMessage(raw, lineIndex, messageIndex, `tool-call-${index}`)
      )
    }
  })

  flushSegment()
  return out
}

function normalizeUserContent(
  raw: RawRecord,
  lineIndex: number,
  messageIndex: number,
  content: unknown
): SessionMessage[] {
  if (typeof content === "string") {
    return [buildUserMessage(raw, lineIndex, messageIndex)]
  }

  if (!Array.isArray(content)) {
    return [buildUserMessage(raw, lineIndex, messageIndex)]
  }

  const blocks = toRecordBlocks(content)
  const textBlocks = blocks.filter(isTextBlock)
  const toolResultBlocks = blocks.filter(isToolResultBlock)

  if (toolResultBlocks.length === 0 && textBlocks.length > 0) {
    return [buildUserMessage(raw, lineIndex, messageIndex)]
  }

  if (textBlocks.length === 0 && toolResultBlocks.length > 0) {
    return toolResultBlocks.map((_, index) =>
      buildToolResultMessage(raw, lineIndex, messageIndex, `tool-result-${index}`)
    )
  }

  if (textBlocks.length === 0 && toolResultBlocks.length === 0) {
    return [buildUserMessage(raw, lineIndex, messageIndex)]
  }

  return blocks.flatMap((block, index) => {
    if (isTextBlock(block)) {
      // Create a shallow copy of raw with only this text block in content
      // so that getMessagePreview and UserMessage render only this block
      const newRaw = {
        ...raw,
        message: {
          ...(asRecord(raw.message) ?? {}),
          content: [block],
        },
      }
      return [buildUserMessage(newRaw, lineIndex, messageIndex, `text-${index}`)]
    }
    if (isToolResultBlock(block)) {
      return [
        buildToolResultMessage(
          raw,
          lineIndex,
          messageIndex,
          `tool-result-${index}`
        ),
      ]
    }
    return []
  })
}

export function normalizeRawSessionMessage(
  rawInput: unknown,
  lineIndex: number,
  messageIndex: number
): SessionMessage[] {
  const raw = asRecord(rawInput) ?? {}
  const rawType = typeof raw.type === "string" ? raw.type : "unknown"
  const message = getRawMessage(raw)
  const role = typeof message?.role === "string" ? message.role : undefined
  const content = message?.content

  if (rawType === "assistant" || role === "assistant") {
    return normalizeAssistantContent(raw, lineIndex, messageIndex, content)
  }

  if (rawType === "user" || role === "user") {
    if (raw.isMeta === true) {
      return [buildMessage(raw, lineIndex, messageIndex, "metadata", "user")]
    }
    return normalizeUserContent(raw, lineIndex, messageIndex, content)
  }

  return [
    buildMessage(
      raw,
      lineIndex,
      messageIndex,
      "metadata",
      getMetadataFilterType(raw)
    ),
  ]
}

export function getMessagePreview(message: SessionMessage, maxLength = 60): string {
  const raw = asRecord(message.raw) ?? {}
  const content = getRawMessage(raw)?.content
  let preview = ""

  if (typeof content === "string") {
    preview = content
  } else if (Array.isArray(content)) {
    preview = toRecordBlocks(content)
      .filter(isTextBlock)
      .map((block) => String(block.text))
      .join(" ")
  }

  if (preview.length <= maxLength) {
    return preview
  }

  return `${preview.slice(0, maxLength)}...`
}

export function isUserInputMessage(message: SessionMessage): boolean {
  return message.kind === "user"
}

export function isToolCallMessage(message: SessionMessage): boolean {
  return message.kind === "tool-call"
}

export function isToolResultMessage(message: SessionMessage): boolean {
  return message.kind === "tool-result"
}

export function getMessageFilterType(message: SessionMessage): string {
  return message.filterType
}
