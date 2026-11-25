import type { PluginHookContext, PluginHookRequests } from "@getpaseo/plugin/server";
import { WORKTREE_PATH_METADATA_KEY } from "../shared/worktree-path";
import { resolveSourceCheckout } from "./source-checkout";

type WorkspaceCreateRequest = PluginHookRequests["workspace.create.before"];

const OVERRIDE_LIFETIME_MS = 5 * 60_000;

type PendingOverride = {
  worktreePathTemplate: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

export function readWorktreePathOverride(request: WorkspaceCreateRequest) {
  const worktreePathTemplate = request.metadata?.[WORKTREE_PATH_METADATA_KEY];
  if (typeof worktreePathTemplate !== "string" || !worktreePathTemplate.trim()) {
    return undefined;
  }
  return worktreePathTemplate.trim();
}

// Placement receives the checkout and branch without the workspace metadata.
export function createWorktreePathOverrides() {
  const pendingByBranch = new Map<string, Map<string, PendingOverride>>();
  let isDisposed = false;

  function take(sourceCheckout: string, branch: string) {
    const pendingByCheckout = pendingByBranch.get(branch);
    const pending = pendingByCheckout?.get(sourceCheckout);
    if (!pendingByCheckout || !pending) {
      return undefined;
    }
    clearTimeout(pending.timer);
    pendingByCheckout.delete(sourceCheckout);
    if (pendingByCheckout.size === 0) {
      pendingByBranch.delete(branch);
    }
    return pending.expiresAt > Date.now() ? pending.worktreePathTemplate : undefined;
  }

  async function remember(
    { source }: WorkspaceCreateRequest,
    { paseo, signal }: PluginHookContext,
    worktreePathTemplate: string | undefined,
    namedSourceCheckout?: string,
  ) {
    if (source.kind !== "worktree") {
      return;
    }
    const branch = source.branchName?.trim();
    if (!branch) {
      if (worktreePathTemplate) {
        console.log(`worktree path override skipped: no branch name yet for ${worktreePathTemplate}`);
      }
      return;
    }
    if (!worktreePathTemplate && !pendingByBranch.has(branch)) {
      return;
    }

    try {
      const sourceCheckout = namedSourceCheckout ?? (await resolveSourceCheckout(source, paseo));
      if (isDisposed || signal.aborted) {
        return;
      }
      take(sourceCheckout, branch);
      if (!worktreePathTemplate) {
        return;
      }
      const pendingByCheckout = pendingByBranch.get(branch) ?? new Map<string, PendingOverride>();
      const timer = setTimeout(() => take(sourceCheckout, branch), OVERRIDE_LIFETIME_MS).unref();
      pendingByCheckout.set(sourceCheckout, {
        worktreePathTemplate,
        expiresAt: Date.now() + OVERRIDE_LIFETIME_MS,
        timer,
      });
      pendingByBranch.set(branch, pendingByCheckout);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`worktree path override skipped: ${reason}`);
    }
  }

  function dispose() {
    isDisposed = true;
    for (const pendingByCheckout of pendingByBranch.values()) {
      for (const pending of pendingByCheckout.values()) {
        clearTimeout(pending.timer);
      }
    }
    pendingByBranch.clear();
  }

  return { remember, take, dispose };
}
