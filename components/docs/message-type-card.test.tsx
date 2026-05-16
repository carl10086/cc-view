import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { MessageTypeCard } from "./message-type-card"

describe("MessageTypeCard", () => {
  const defaultProps = {
    filterType: "system",
    label: "system",
    color: "text-neutral-500",
    bgColor: "bg-neutral-100 dark:bg-neutral-800",
    description: "系统内部事件消息",
  }

  it("renders label badge with correct text", () => {
    render(<MessageTypeCard {...defaultProps} />)
    const badge = screen.getByTestId("badge-label")
    expect(badge.textContent).toBe("system")
  })

  it("renders filterType name", () => {
    render(<MessageTypeCard {...defaultProps} />)
    expect(screen.getByTestId("filter-type").textContent).toBe("system")
  })

  it("renders description text", () => {
    render(<MessageTypeCard {...defaultProps} />)
    expect(screen.getByText("系统内部事件消息")).toBeTruthy()
  })

  it("does not show JSON example by default", () => {
    render(
      <MessageTypeCard
        {...defaultProps}
        exampleJson={{ type: "system", content: "test" }}
      />
    )
    expect(screen.queryByTestId("json-example")).toBeNull()
  })

  it("toggles JSON example on click", () => {
    render(
      <MessageTypeCard
        {...defaultProps}
        exampleJson={{ type: "system", content: "test" }}
      />
    )
    const toggleButton = screen.getByRole("button")
    fireEvent.click(toggleButton)
    expect(screen.getByTestId("json-example")).toBeTruthy()

    fireEvent.click(toggleButton)
    expect(screen.queryByTestId("json-example")).toBeNull()
  })

  it("renders without exampleJson", () => {
    render(<MessageTypeCard {...defaultProps} />)
    expect(screen.getByText("系统内部事件消息")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("applies color classes to badge", () => {
    render(<MessageTypeCard {...defaultProps} />)
    const badge = screen.getByTestId("badge-label")
    expect(badge.className).toContain("text-neutral-500")
    expect(badge.className).toContain("bg-neutral-100")
  })
})
