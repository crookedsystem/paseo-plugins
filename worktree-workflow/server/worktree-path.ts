import { basename, resolve } from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import type {
  PluginHookContext,
  PluginHookRequests,
  PluginSettings,
} from "@getpaseo/plugin/server";
import {
  DEFAULT_WORKTREE_PATH_TEMPLATE,
  expandWorktreePathTemplate,
  type previewWorktreePathRpc,
  type worktreePathSettings,
} from "../shared/worktree-path";
import { resolveSourceCheckout } from "./source-checkout";

type WorktreeCreateRequest = PluginHookRequests["worktree.create.before"];
export type WorktreePathSettingsStore = PluginSettings<(typeof worktreePathSettings)["schema"]>;

// Example: ~/src/fanplus-api + feat/worktree + "../{repo}__worktrees/{branch}"
//   → ~/src/fanplus-api__worktrees/feat-worktree
export function resolveWorktreePath(
  sourceCheckout: string,
  branch: string,
  worktreePathTemplate: string,
) {
  const relativeWorktreePath = expandWorktreePathTemplate(worktreePathTemplate, {
    repositoryName: basename(sourceCheckout),
    branch,
  });
  return resolve(sourceCheckout, relativeWorktreePath);
}

export function placeWorktree(request: WorktreeCreateRequest, worktreePathTemplate: string) {
  const path = resolveWorktreePath(request.sourceCheckout, request.branch, worktreePathTemplate);
  console.log(`worktree path: ${request.branch} → ${path}`);
  return { ...request, path };
}

// Invalid stored settings fall back to the built-in default so worktree creation keeps working.
export async function readDefaultWorktreePathTemplate(settings: WorktreePathSettingsStore) {
  const state = await settings.read();
  if (state.status === "ready") {
    return state.values.worktreePathTemplate;
  }
  console.log(`worktree path settings are invalid, using the built-in default: ${state.error}`);
  return DEFAULT_WORKTREE_PATH_TEMPLATE;
}

export async function previewWorktreePaths(
  { projectId, worktreePathTemplates, branch }: RpcInput<typeof previewWorktreePathRpc>,
  paseo: PluginHookContext["paseo"],
) {
  const sourceCheckout = await resolveSourceCheckout({ projectId }, paseo);
  const previewBranch = branch ?? "<branch>";
  return {
    previews: worktreePathTemplates.map((worktreePathTemplate) => ({
      worktreePathTemplate,
      worktreePath: resolveWorktreePath(sourceCheckout, previewBranch, worktreePathTemplate),
    })),
  };
}
