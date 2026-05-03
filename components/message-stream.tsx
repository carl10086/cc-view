import { forwardRef, useMemo } from "react"
import { MessageTurn } from "./message/message-turn"
import { groupMessagesIntoTurns } from "@/lib/message-grouping"
import type { SessionMessage } from "@/types/claude"

interface MessageStreamProps {
  messages: SessionMessage[]
}

export const MessageStream = forwardRef<HTMLDivElement, MessageStreamProps>(
  function MessageStream({ messages }, ref) {
    const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages])

    if (messages.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-neutral-500">No messages in this session</p>
        </div>
      )
    }

    return (
      <div ref={ref} className="h-full overflow-y-auto">
        <div className="space-y-2 px-2 py-2">
          {turns.map((turn) => (
            <MessageTurn key={turn.id} turn={turn} />
          ))}
        </div>
      </div>
    )
  }
)
