export const WORKTREE_MARKER = "--claude-worktrees-"

const MAX_NAME_LENGTH = 255

export function buildWorktreeProjectId(
  mainId: string,
  worktreeName: string
): string {
  if (
    !mainId ||
    mainId.includes("..") ||
    mainId.includes("/") ||
    mainId.includes("\\") ||
    mainId.includes(WORKTREE_MARKER)
  ) {
    throw new Error(`Invalid mainId: ${mainId}`)
  }
  if (
    !worktreeName ||
    worktreeName.includes("..") ||
    worktreeName.includes("/") ||
    worktreeName.includes("\\") ||
    worktreeName.includes(WORKTREE_MARKER)
  ) {
    throw new Error(`Invalid worktreeName: ${worktreeName}`)
  }
  if (mainId.length > MAX_NAME_LENGTH || worktreeName.length > MAX_NAME_LENGTH) {
    throw new Error("mainId or worktreeName too long")
  }
  return `${mainId}${WORKTREE_MARKER}${worktreeName}`
}
