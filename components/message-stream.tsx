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
    const turnsRef = useRef(turns)
    useEffect(() => { turnsRef.current = turns }, [turns])
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

    const virtualizer = useVirtualizer({
      count: turns.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 150,
      measureElement: (el) => el.getBoundingClientRect().height,
      overscan: 5,
    })

    useImperativeHandle(forwardedRef, () => ({
      scrollToMessage: (messageId: string) => {
        const currentTurns = turnsRef.current
        const turnIndex = currentTurns.findIndex(
          (turn) =>
            turn.user?.id === messageId ||
            turn.events.some((msg) => msg.id === messageId) ||
            turn.metadata.some((msg) => msg.id === messageId)
        )
        if (turnIndex !== -1) {
          virtualizer.scrollToIndex(turnIndex, { align: "start" })
          setHighlightedMessageId(messageId)
        }
      },
      scrollToTop: () => {
        if (turnsRef.current.length > 0) {
          virtualizer.scrollToIndex(0, { align: "start" })
        }
      },
      scrollToBottom: () => {
        const currentTurns = turnsRef.current
        if (currentTurns.length > 0) {
          virtualizer.scrollToIndex(currentTurns.length - 1, { align: "end" })
        }
      },
    }), [virtualizer])

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
