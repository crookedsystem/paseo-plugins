import type { PluginServerContext } from "@getpaseo/plugin/server";
import { nameBranchFromFirstPrompt } from "./server/branch-name-from-prompt";
import {
  placeWorktree,
  previewWorktreePaths,
  readDefaultWorktreePathTemplate,
} from "./server/worktree-path";
import {
  createWorktreePathOverrides,
  readWorktreePathOverride,
} from "./server/worktree-path-overrides";
import { previewWorktreePathRpc, worktreePathSettings } from "./shared/worktree-path";

// When a worktree is created with a first prompt but no branch name, the branch is named from that prompt
// before the worktree exists. Every new worktree is placed at the path template chosen on the New workspace
// screen, or else at the default template from the plugin settings.
export default function contribute(server: PluginServerContext) {
  const worktreePathSettingsStore = server.registerSettings(worktreePathSettings);
  const worktreePathOverrides = createWorktreePathOverrides();
  server.handle(previewWorktreePathRpc, (input, { paseo }) => previewWorktreePaths(input, paseo));

  const removeWorkspaceHook = server.addHook(
    "workspace.create.before",
    async ({ request }, context) => {
      const worktreePathOverride = readWorktreePathOverride(request);
      const namedWorktree = await nameBranchFromFirstPrompt(request, context, () =>
        worktreePathOverride ?? readDefaultWorktreePathTemplate(worktreePathSettingsStore),
      );
      await worktreePathOverrides.remember(
        namedWorktree?.request ?? request,
        context,
        worktreePathOverride,
        namedWorktree?.sourceCheckout,
      );
      return namedWorktree?.request;
    },
  );
  const removePlacementHook = server.addHook("worktree.create.before", async ({ request }) => {
    const worktreePathTemplate =
      worktreePathOverrides.take(request.sourceCheckout, request.branch) ??
      (await readDefaultWorktreePathTemplate(worktreePathSettingsStore));
    return placeWorktree(request, worktreePathTemplate);
  });
  return () => {
    removeWorkspaceHook();
    removePlacementHook();
    worktreePathOverrides.dispose();
  };
}
