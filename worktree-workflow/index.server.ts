import type { PluginServerContext } from "@getpaseo/plugin/server";
import { nameBranchFromFirstPrompt } from "./server/branch-name-from-prompt";
import {
  placeWorktree,
  previewWorktreePath,
  readDefaultWorktreePathTemplate,
} from "./server/worktree-path";
import {
  readWorktreePathOverride,
  rememberWorktreePathOverride,
  takeWorktreePathOverride,
} from "./server/worktree-path-overrides";
import { previewWorktreePathRpc, worktreePathSettings } from "./shared/worktree-path";

// When a worktree is created with a first prompt but no branch name, the branch is named from that prompt
// before the worktree exists. Every new worktree is placed at the path template chosen on the New workspace
// screen, or else at the default template from the plugin settings.
export default function contribute(server: PluginServerContext) {
  const worktreePathSettingsStore = server.registerSettings(worktreePathSettings);
  server.handle(previewWorktreePathRpc, (input, { paseo }) => previewWorktreePath(input, paseo));

  const removeWorkspaceHook = server.addHook(
    "workspace.create.before",
    async ({ request }, context) => {
      const worktreePathOverride = readWorktreePathOverride(request);
      const worktreePathTemplate =
        worktreePathOverride ?? (await readDefaultWorktreePathTemplate(worktreePathSettingsStore));
      const namedRequest = await nameBranchFromFirstPrompt(request, context, worktreePathTemplate);
      if (worktreePathOverride) {
        rememberWorktreePathOverride(namedRequest ?? request, worktreePathOverride);
      }
      return namedRequest;
    },
  );
  const removePlacementHook = server.addHook("worktree.create.before", async ({ request }) => {
    const worktreePathTemplate =
      takeWorktreePathOverride(request.branch) ??
      (await readDefaultWorktreePathTemplate(worktreePathSettingsStore));
    return placeWorktree(request, worktreePathTemplate);
  });
  return () => {
    removeWorkspaceHook();
    removePlacementHook();
  };
}
