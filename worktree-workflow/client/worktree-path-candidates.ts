import { containsBranchPlaceholder, DEFAULT_WORKTREE_PATH_TEMPLATE } from "../shared/worktree-path";

const SUGGESTED_WORKTREE_PATH_TEMPLATES = [
  DEFAULT_WORKTREE_PATH_TEMPLATE,
  ".worktrees/{branch}",
  "../{repo}-{branch}",
];

// Offers the saved default first, then common relative paths. A typed path that does not name the
// branch is also offered as a parent folder, so typing "../wt" suggests "../wt/{branch}".
export function listWorktreePathCandidates(typedTemplate: string, defaultTemplate: string) {
  const trimmedTemplate = typedTemplate.trim();
  const parentFolderCandidates =
    trimmedTemplate && !containsBranchPlaceholder(trimmedTemplate)
      ? [`${trimmedTemplate.replace(/\/+$/, "")}/{branch}`]
      : [];
  const candidates = [
    ...parentFolderCandidates,
    defaultTemplate,
    ...SUGGESTED_WORKTREE_PATH_TEMPLATES,
  ];
  return [...new Set(candidates)];
}

// git rejects branch names with spaces, so whitespace becomes -. An empty name means "let Paseo
// or the first prompt name it".
export function normalizeBranchName(typedBranchName: string) {
  const branchName = typedBranchName.trim().replace(/\s+/g, "-");
  return branchName || null;
}
