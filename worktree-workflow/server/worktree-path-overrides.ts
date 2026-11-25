import type { PluginHookRequests } from "@getpaseo/plugin/server";
import { WORKTREE_PATH_METADATA_KEY } from "../shared/worktree-path";

type WorkspaceCreateRequest = PluginHookRequests["workspace.create.before"];

// worktree.create.before does not receive workspace metadata, so a one-off path chosen on the
// New workspace screen is handed over by branch name. Entries expire in case creation fails
// before the worktree hook runs.
const OVERRIDE_LIFETIME_MS = 5 * 60_000;
const pendingOverridesByBranch = new Map<string, { worktreePathTemplate: string; expiresAt: number }>();

export function readWorktreePathOverride(request: WorkspaceCreateRequest) {
  const worktreePathTemplate = request.metadata?.[WORKTREE_PATH_METADATA_KEY];
  if (typeof worktreePathTemplate !== "string" || !worktreePathTemplate.trim()) {
    return undefined;
  }
  return worktreePathTemplate.trim();
}

// The branch name is known only when the user typed it or it was named from the first prompt.
// When Paseo picks it later, the one-off path cannot be matched and the default path is used.
export function rememberWorktreePathOverride(
  request: WorkspaceCreateRequest,
  worktreePathTemplate: string,
) {
  const { source } = request;
  const branch = source.kind === "worktree" ? source.branchName : undefined;
  if (!branch) {
    console.log(`worktree path override skipped: no branch name yet for ${worktreePathTemplate}`);
    return;
  }
  pendingOverridesByBranch.set(branch, {
    worktreePathTemplate,
    expiresAt: Date.now() + OVERRIDE_LIFETIME_MS,
  });
}

export function takeWorktreePathOverride(branch: string) {
  const pendingOverride = pendingOverridesByBranch.get(branch);
  pendingOverridesByBranch.delete(branch);
  if (!pendingOverride || pendingOverride.expiresAt < Date.now()) {
    return undefined;
  }
  return pendingOverride.worktreePathTemplate;
}
