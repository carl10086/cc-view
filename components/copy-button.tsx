"use client"

import { useState, useCallback, useEffect } from "react"
import { Copy, Check } from "lucide-react"

interface CopyButtonProps {
  text: string
  title?: string
}

export function CopyButton({ text, title = "复制到剪贴板" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1000)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // 静默失败，不打扰用户
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
      title={title}
    >
      {copied ? (
        <Check data-testid="check-icon" className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy data-testid="copy-icon" className="h-3.5 w-3.5" />
      )}
      {copied ? "已复制" : "复制"}
    </button>
  )
}
