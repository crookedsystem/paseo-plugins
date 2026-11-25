import { basename } from "node:path";
import type { PluginHookContext, PluginHookRequests } from "@getpaseo/plugin/server";
import { resolveSourceCheckout } from "./source-checkout";
import { resolveWorktreePath } from "./worktree-path";

type WorkspaceCreateRequest = PluginHookRequests["workspace.create.before"];

// Paseo titles a new worktree workspace with the first prompt and later with an AI title, but it
// keeps any title the request already carries. Naming the workspace after its worktree folder here
// keeps the sidebar name and the folder name the same.
// Returns undefined when the caller chose a title or the branch name is not known yet.
export async function titleWorkspaceAfterWorktreeFolder(
  request: WorkspaceCreateRequest,
  paseo: PluginHookContext["paseo"],
  worktreePathTemplate: string,
) {
  const { source } = request;
  const hasCallerTitle = Boolean(request.title?.trim());
  if (source.kind !== "worktree" || !source.branchName || hasCallerTitle) {
    return undefined;
  }
  try {
    const sourceCheckout = await resolveSourceCheckout(source, paseo);
    const worktreePath = resolveWorktreePath(sourceCheckout, source.branchName, worktreePathTemplate);
    return { ...request, title: basename(worktreePath) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`workspace title from worktree folder skipped: ${reason}`);
    return undefined;
  }
}
