import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { AttachmentTypeTable } from "./attachment-type-table"

describe("AttachmentTypeTable", () => {
  const mockCategories = [
    {
      name: "Hook 相关",
      subtypes: [
        { type: "hook_success", description: "成功" },
        { type: "hook_error", description: "错误" },
      ],
    },
    {
      name: "Skill 相关",
      subtypes: [{ type: "skill_listing", description: "技能列表" }],
    },
  ]

  it("renders all categories", () => {
    render(<AttachmentTypeTable categories={mockCategories} />)
    expect(screen.getByText("Hook 相关")).toBeTruthy()
    expect(screen.getByText("Skill 相关")).toBeTruthy()
  })

  it("renders subtypes within each category", () => {
    render(<AttachmentTypeTable categories={mockCategories} />)
    expect(screen.getByText("hook_success")).toBeTruthy()
    expect(screen.getByText("skill_listing")).toBeTruthy()
  })

  it("renders empty when no categories", () => {
    render(<AttachmentTypeTable categories={[]} />)
    expect(screen.queryByText("Hook 相关")).toBeNull()
  })
})