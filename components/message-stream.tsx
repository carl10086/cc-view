"use client"

import { forwardRef, useMemo, useRef, useImperativeHandle, useEffect, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { MessageTurn } from "./message/message-turn"
import { groupMessagesIntoTurns } from "@/lib/message-grouping"
import type { SessionMessage } from "@/types/claude"

export interface MessageStreamHandle {
  scrollToMessage: (messageId: string) => void
  scrollToTop: () => void
  scrollToBottom: () => void
}

interface MessageStreamProps {
  messages: SessionMessage[]
  onScrollNearBottom?: () => void
  filterActive?: boolean
  hasMore?: boolean
}

export const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(
  function MessageStream({ messages, onScrollNearBottom, filterActive, hasMore }, forwardedRef) {
    const parentRef = useRef<HTMLDivElement>(null)
    const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages])
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

    useImperativeHandle(forwardedRef, () => ({
      scrollToMessage: (messageId: string) => {
        // Find the turn containing this message
        const turnIndex = turns.findIndex(
          (turn) =>
            turn.user?.id === messageId ||
            turn.assistant?.id === messageId ||
            turn.metadata.some((msg) => msg.id === messageId)
        )
        if (turnIndex !== -1) {
          virtualizer.scrollToIndex(turnIndex, { align: "center" })
          setHighlightedMessageId(messageId)
        }
      },
      scrollToTop: () => {
        if (parentRef.current) {
          parentRef.current.scrollTop = 0
        }
      },
      scrollToBottom: () => {
        if (parentRef.current) {
          parentRef.current.scrollTop = parentRef.current.scrollHeight
        }
      },
    }))

    const virtualizer = useVirtualizer({
      count: turns.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 150,
      measureElement: (el) => el.getBoundingClientRect().height,
      overscan: 5,
    })

    const virtualItems = virtualizer.getVirtualItems()

    useEffect(() => {
      if (!hasMore || turns.length === 0) return
      const lastItem = virtualItems[virtualItems.length - 1]
      if (lastItem && lastItem.index >= turns.length - 3) {
        onScrollNearBottom?.()
      }
    }, [virtualItems, turns.length, onScrollNearBottom, hasMore])

    if (messages.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-neutral-500">
            {filterActive ? "No messages match the filter" : "No messages in this session"}
          </p>
        </div>
      )
    }

    return (
      <div ref={parentRef} className="h-full overflow-y-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MessageTurn turn={turns[virtualItem.index]} highlightedMessageId={highlightedMessageId} />
            </div>
          ))}
        </div>
      </div>
    )
  }
)
