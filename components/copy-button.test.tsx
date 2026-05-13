import { render, screen, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CopyButton } from "./copy-button"

describe("CopyButton", () => {
  const mockWriteText = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText,
      },
    })
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("renders Copy icon and '复制' text by default", () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByText("复制")).toBeTruthy()
    expect(document.querySelector("svg")).toBeTruthy()
  })

  it("calls navigator.clipboard.writeText with the given text on click", async () => {
    render(<CopyButton text="--resume abc123" />)
    const button = screen.getByRole("button")
    await act(async () => {
      fireEvent.click(button)
    })
    expect(mockWriteText).toHaveBeenCalledWith("--resume abc123")
  })

  it("shows '已复制' text after click", async () => {
    render(<CopyButton text="hello" />)
    const button = screen.getByRole("button")
    await act(async () => {
      fireEvent.click(button)
    })
    expect(screen.getByText("已复制")).toBeTruthy()
  })

  it("reverts to '复制' text after 1 second", async () => {
    vi.useFakeTimers()
    render(<CopyButton text="hello" />)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })
    expect(screen.getByText("已复制")).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText("复制")).toBeTruthy()
    vi.useRealTimers()
  })

  it("does not throw when clipboard.writeText fails", async () => {
    mockWriteText.mockRejectedValue(new Error("Clipboard denied"))
    render(<CopyButton text="hello" />)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    expect(screen.getByText("复制")).toBeTruthy()
  })
})
