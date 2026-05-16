import { MessageTypeCard } from "@/components/docs/message-type-card"
import { SystemSubtypeTable } from "@/components/docs/system-subtype-table"
import { AttachmentTypeTable } from "@/components/docs/attachment-type-table"
import { ScrollToTop } from "@/components/docs/scroll-to-top"
import { mainMessageTypes, systemSubtypes, attachmentCategories } from "@/lib/message-types-data"

export default function MessageTypesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Message Types 文档
          </h1>
          <p className="text-muted-foreground text-lg">
            了解 Claude Code 会话中每种消息类型的含义和用途
          </p>
        </div>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            主要消息类型
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mainMessageTypes.map((type) => (
              <MessageTypeCard
                key={type.filterType}
                filterType={type.filterType}
                label={type.label}
                color={type.color}
                bgColor={type.bgColor}
                description={type.description}
                exampleJson={type.exampleJson}
              />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            System Message 子类型
          </h2>
          <p className="text-muted-foreground mb-4">
            system 消息包含多种子类型，用于记录 Claude Code 运行时的不同内部事件：
          </p>
          <SystemSubtypeTable subtypes={systemSubtypes} />
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Attachment 子类型
          </h2>
          <p className="text-muted-foreground mb-6">
            attachment 类型包含多种子类型，按功能分为 Hook、Skill、Agent 三大类：
          </p>
          <AttachmentTypeTable categories={attachmentCategories} />
        </section>

        <ScrollToTop />
      </div>
    </div>
  )
}
