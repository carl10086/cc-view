"use client"

import { forwardRef, useMemo, useRef, useImperativeHandle, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { MessageTurn } from "./message/message-turn"
import { FocusContextBar } from "./message/focus-context-bar"
import { groupMessagesIntoTurns } from "@/lib/message-grouping"
import type { SessionMessage } from "@/types/claude"

interface MessageStreamProps {
  messages: SessionMessage[]
  onScrollNearBottom?: () => void
  filterActive?: boolean
  hasMore?: boolean
  focusedTurnId?: string
  onFocusTurn?: (turnId: string) => void
  onClearFocus?: () => void
}

export const MessageStream = forwardRef<HTMLDivElement, MessageStreamProps>(
  function MessageStream({ messages, onScrollNearBottom, filterActive, hasMore, focusedTurnId, onFocusTurn, onClearFocus }, forwardedRef) {
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
      if (!hasMore || turns.length === 0) return
      const lastItem = virtualItems[virtualItems.length - 1]
      if (lastItem && lastItem.index >= turns.length - 3) {
        onScrollNearBottom?.()
      }
    }, [virtualItems, turns.length, onScrollNearBottom, hasMore])

    // Auto-scroll to focused turn
    useEffect(() => {
      if (!focusedTurnId || turns.length === 0) return
      const focusedIndex = turns.findIndex((t) => t.id === focusedTurnId)
      if (focusedIndex >= 0) {
        virtualizer.scrollToIndex(focusedIndex, { align: "center", behavior: "smooth" })
      }
    }, [focusedTurnId, turns, virtualizer])

    // ESC to exit focus mode
    useEffect(() => {
      if (!focusedTurnId) return
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          onClearFocus?.()
        }
      }
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [focusedTurnId, onClearFocus])

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
        {focusedTurnId && onClearFocus && (
          <FocusContextBar messageCount={messages.length} onClear={onClearFocus} />
        )}
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
              <MessageTurn
                turn={turns[virtualItem.index]}
                isFocused={turns[virtualItem.index].id === focusedTurnId}
                showFocusButton={filterActive && !focusedTurnId}
                onFocus={() => onFocusTurn?.(turns[virtualItem.index].id)}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }
)
