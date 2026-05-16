import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { SystemSubtypeTable } from "./system-subtype-table"

describe("SystemSubtypeTable", () => {
  const mockSubtypes = [
    { subtype: "informational", description: "信息提示" },
    { subtype: "api_error", description: "API 错误" },
  ]

  it("renders table with all subtypes", () => {
    render(<SystemSubtypeTable subtypes={mockSubtypes} />)
    expect(screen.getByText("informational")).toBeTruthy()
    expect(screen.getByText("api_error")).toBeTruthy()
    expect(screen.getByText("信息提示")).toBeTruthy()
    expect(screen.getByText("API 错误")).toBeTruthy()
  })

  it("renders empty table when no subtypes", () => {
    render(<SystemSubtypeTable subtypes={[]} />)
    expect(screen.queryByText("informational")).toBeNull()
  })

  it("renders correct number of rows", () => {
    render(<SystemSubtypeTable subtypes={mockSubtypes} />)
    const rows = screen.getAllByRole("row")
    // header + 2 data rows
    expect(rows.length).toBe(3)
  })
})