import type { PluginClientContext } from "@getpaseo/plugin/client";
import { WorktreeField } from "./client/worktree-field";
import { WorktreePathSettingsScreen } from "./client/worktree-path-settings-screen";

export default function contribute(client: PluginClientContext) {
  const removeWorktreeField = client.addNewWorkspaceItem({
    id: "worktree",
    Component: WorktreeField,
  });
  const removeWorktreePathSettings = client.addSettingsScreen({
    id: "worktree-path",
    title: "Worktree path",
    icon: "FolderTree",
    Component: WorktreePathSettingsScreen,
  });
  return () => {
    removeWorktreeField();
    removeWorktreePathSettings();
  };
}
