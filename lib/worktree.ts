export const WORKTREE_MARKER = "--claude-worktrees-"

export function buildWorktreeProjectId(mainId: string, worktreeName: string): string {
  return `${mainId}${WORKTREE_MARKER}${worktreeName}`
}
