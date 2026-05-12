import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { AssistantMessage } from "./assistant-message"
import type { SessionMessage } from "@/types/claude"

describe("AssistantMessage Markdown Rendering", () => {
  const createMockMessage = (text: string): SessionMessage => ({
    id: "msg-1",
    type: "assistant",
    kind: "assistant",
    filterType: "assistant",
    timestamp: new Date("2024-01-01T00:00:00Z"),
    parentUuid: null,
    raw: {
      message: {
        content: [{ type: "text", text }],
      },
    },
  })

  it("renders bold text", () => {
    const { container } = render(
      <AssistantMessage message={createMockMessage("This is **bold** text")} />
    )
    expect(container.querySelector("strong")).toBeTruthy()
    expect(container.querySelector("strong")?.textContent).toBe("bold")
  })

  it("renders italic text", () => {
    const { container } = render(
      <AssistantMessage message={createMockMessage("This is *italic* text")} />
    )
    expect(container.querySelector("em")).toBeTruthy()
    expect(container.querySelector("em")?.textContent).toBe("italic")
  })

  it("renders inline code", () => {
    const { container } = render(
      <AssistantMessage message={createMockMessage("Use `const x = 1`")} />
    )
    expect(container.querySelector("code")).toBeTruthy()
    expect(container.querySelector("code")?.textContent).toBe("const x = 1")
  })

  it("renders link", () => {
    const { container } = render(
      <AssistantMessage
        message={createMockMessage("[Click here](https://example.com)")}
      />
    )
    const link = container.querySelector("a")
    expect(link).toBeTruthy()
    expect(link?.textContent).toBe("Click here")
    expect(link?.getAttribute("href")).toBe("https://example.com")
  })

  it("renders blockquote", () => {
    const { container } = render(
      <AssistantMessage message={createMockMessage("> This is a quote")} />
    )
    expect(container.querySelector("blockquote")).toBeTruthy()
  })

  it("renders unordered list", () => {
    const { container } = render(
      <AssistantMessage message={createMockMessage("- Item 1\n- Item 2")} />
    )
    expect(container.querySelector("ul")).toBeTruthy()
    expect(container.querySelectorAll("li").length).toBe(2)
  })

  it("renders table", () => {
    const { container } = render(
      <AssistantMessage
        message={createMockMessage("| Header | Cell |\n| --- | --- |\n| Value | Data |")}
      />
    )
    expect(container.querySelector("table")).toBeTruthy()
    expect(container.querySelector("th")?.textContent).toBe("Header")
    expect(container.querySelector("td")?.textContent).toBe("Value")
  })

  it("renders code block with language", () => {
    const { container } = render(
      <AssistantMessage
        message={createMockMessage("```js\nconst x = 1\n```")}
      />
    )
    const pre = container.querySelector("pre")
    expect(pre).toBeTruthy()
    expect(pre?.querySelector("code")).toBeTruthy()
  })
})
