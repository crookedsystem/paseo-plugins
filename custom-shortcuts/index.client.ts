import {
  listenForCommandCenterTabShortcuts,
  mergeShortcutOverrides,
  type CommandCenterTabShortcut,
  type ShortcutOverrides,
} from "./client/web";

// The default Cmd+Shift+Arrow pane focus bindings are disabled while a text
// field has focus. Bindings the user sets drop that condition, so writing them
// as user overrides makes pane focus work from the composer too. Option is
// spelled Alt in the app's key combo format. Pin chat gives up Cmd+Shift+P to
// the Actions tab shortcut below; null unbinds it.
const shortcutOverrides: ShortcutOverrides = {
  "workspace-pane-focus-left-cmd-shift-left": "Cmd+Alt+ArrowLeft",
  "workspace-pane-focus-right-cmd-shift-right": "Cmd+Alt+ArrowRight",
  "workspace-pane-focus-up-cmd-shift-up": "Cmd+Alt+ArrowUp",
  "workspace-pane-focus-down-cmd-shift-down": "Cmd+Alt+ArrowDown",
  "workspace-pin-cmd-shift-p-mac": null,
};

const commandCenterTabShortcuts: CommandCenterTabShortcut[] = [
  { code: "KeyO", tab: "workspaces" },
  { code: "KeyP", tab: "actions" },
];

export default function contribute() {
  mergeShortcutOverrides(shortcutOverrides);
  return listenForCommandCenterTabShortcuts(commandCenterTabShortcuts);
}
