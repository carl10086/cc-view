"use client"

import { forwardRef, useMemo, useRef, useImperativeHandle, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { MessageTurn } from "./message/message-turn"
import { groupMessagesIntoTurns } from "@/lib/message-grouping"
import type { SessionMessage } from "@/types/claude"

interface MessageStreamProps {
  messages: SessionMessage[]
  onScrollNearBottom?: () => void
  filterActive?: boolean
}

export const MessageStream = forwardRef<HTMLDivElement, MessageStreamProps>(
  function MessageStream({ messages, onScrollNearBottom, filterActive }, forwardedRef) {
    const parentRef = useRef<HTMLDivElement>(null)
    const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages])

    useImperativeHandle(forwardedRef, () => parentRef.current!)

    const virtualizer = useVirtualizer({
      count: turns.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 150,
      measureElement: (el) => el.getBoundingClientRect().height,
      overscan: 5,
    })

    const virtualItems = virtualizer.getVirtualItems()

    useEffect(() => {
      const lastItem = virtualItems[virtualItems.length - 1]
      if (lastItem && lastItem.index >= turns.length - 3) {
        onScrollNearBottom?.()
      }
    }, [virtualItems, turns.length, onScrollNearBottom])

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
              <MessageTurn turn={turns[virtualItem.index]} />
            </div>
          ))}
        </div>
      </div>
    )
  }
)
