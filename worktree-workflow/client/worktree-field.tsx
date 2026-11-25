import { type PluginNewWorkspaceItemProps, useNewWorkspace } from "@getpaseo/plugin/client";
import { Action } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { WORKTREE_PATH_METADATA_KEY } from "../shared/worktree-path";
import { WorktreeOptionsModal } from "./worktree-options-modal";

// One New workspace field for the new worktree's branch name and path. Its label shows the current
// choice, and pressing it opens a dialog that edits both.
export function WorktreeField({ theme }: PluginNewWorkspaceItemProps) {
  const newWorkspace = useNewWorkspace();
  const [isEditing, setIsEditing] = useState(false);
  // Paseo uses the branch name only for a worktree that cuts a new branch, and ignores it when a PR is the base.
  const isWorktreeOptionApplicable =
    newWorkspace.isolation === "worktree" && newWorkspace.baseRef?.type !== "change-request";
  const chosenTemplate = newWorkspace.metadata[WORKTREE_PATH_METADATA_KEY];
  const branchLabel = newWorkspace.branch ?? "Automatic branch";
  const pathLabel = typeof chosenTemplate === "string" ? chosenTemplate : "default path";

  return (
    <>
      <Action
        title={`${branchLabel} · ${pathLabel}`}
        icon="GitBranch"
        disabled={!isWorktreeOptionApplicable}
        onPress={() => setIsEditing(true)}
      />
      {isEditing ? (
        <WorktreeOptionsModal theme={theme} newWorkspace={newWorkspace} close={() => setIsEditing(false)} />
      ) : null}
    </>
  );
}
