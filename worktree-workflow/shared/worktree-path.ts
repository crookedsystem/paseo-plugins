import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

// Paths are relative to the source repository. {repo} is its folder name and {branch} is the
// branch name with / replaced by -.
export const DEFAULT_WORKTREE_PATH_TEMPLATE = "../{repo}__worktrees/{branch}";
const BRANCH_PLACEHOLDER = "{branch}";

// Workspace metadata key the New workspace field uses to pass a one-off path to the daemon hooks.
export const WORKTREE_PATH_METADATA_KEY = "worktreeWorkflow.worktreePathTemplate";

export function containsBranchPlaceholder(worktreePathTemplate: string) {
  return worktreePathTemplate.includes(BRANCH_PLACEHOLDER);
}

export const defaultWorktreePathTemplateSchema = z
  .string()
  .trim()
  .min(1, "Enter a path")
  .refine(
    containsBranchPlaceholder,
    "A default path must contain {branch}, or every worktree would get the same folder",
  );

export const worktreePathSettings = defineSettings({
  id: "worktree-path",
  scope: "host",
  version: 1,
  schema: z.object({
    worktreePathTemplate: defaultWorktreePathTemplateSchema.default(DEFAULT_WORKTREE_PATH_TEMPLATE),
  }),
});

export function expandWorktreePathTemplate(
  worktreePathTemplate: string,
  { repositoryName, branch }: { repositoryName: string; branch: string },
) {
  const branchPath = branch.replaceAll("/", "-");
  return worktreePathTemplate.replace(/\{repo\}|\{branch\}/g, (placeholder) =>
    placeholder === BRANCH_PLACEHOLDER ? branchPath : repositoryName,
  );
}

// Resolves templates to the absolute paths they would create, so the app can show them before creation.
export const previewWorktreePathRpc = defineRpc({
  name: "worktree-path.preview",
  input: z.object({
    projectId: z.string(),
    worktreePathTemplates: z.array(z.string()),
    branch: z.string().nullable(),
  }),
  output: z.object({
    previews: z.array(z.object({ worktreePathTemplate: z.string(), worktreePath: z.string() })),
  }),
});
