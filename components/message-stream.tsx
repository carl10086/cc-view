import { forwardRef } from "react"
import { MessageCard } from "./message-card"
import type { SessionMessage } from "@/types/claude"

interface MessageStreamProps {
  messages: SessionMessage[]
}

export const MessageStream = forwardRef<HTMLDivElement, MessageStreamProps>(
  function MessageStream({ messages }, ref) {
    if (messages.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-neutral-500">No messages in this session</p>
        </div>
      )
    }

    return (
      <div ref={ref} className="h-full overflow-y-auto">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {messages.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
        </div>
      </div>
    )
  }
)
