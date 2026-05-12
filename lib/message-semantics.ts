import type { SessionMessage, SessionMessageKind } from "@/types/claude"

type RawRecord = Record<string, unknown>

function asRecord(value: unknown): RawRecord | undefined {
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
      return [buildUserMessage(raw, lineIndex, messageIndex, `text-${index}`)]
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
    return [buildMessage(raw, lineIndex, messageIndex, "assistant", "assistant")]
  }

  if (rawType === "user" || role === "user") {
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

export function isToolResultMessage(message: SessionMessage): boolean {
  return message.kind === "tool-result"
}

export function getMessageFilterType(message: SessionMessage): string {
  return message.filterType
}
