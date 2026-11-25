A small set of macOS keyboard shortcuts for the Paseo desktop app.

| Shortcut | What it does |
|---|---|
| Cmd+Option+Left, Right, Up, Down | Moves focus to the neighbouring split pane, even while the cursor is in the message composer |
| Cmd+Shift+O | Opens the command center on the Workspaces tab |
| Cmd+Shift+P | Opens the command center on the Actions tab |

## How it works

Paseo's default Focus pane shortcuts (Cmd+Shift+Arrow) do nothing while a text field has focus. Shortcuts you rebind yourself do not have that restriction, so the plugin writes the four pane focus bindings into the app's shortcut settings each time the app loads it. Your other custom shortcuts stay as they are. The first time, the app may read its settings before the plugin writes them, so reload the window once or twice until the new keys appear under Keyboard shortcuts.

Paseo has no shortcut setting that opens the command center on a specific tab. For Cmd+Shift+O and Cmd+Shift+P the plugin sends the app the same keys you would press yourself: Cmd+K to open the command center, then Tab for Workspaces or Shift+Tab for Actions.

Cmd+Shift+P is Paseo's default shortcut for Pin chat. The plugin unbinds it there, so Pin chat no longer has a shortcut.

## Known limits

- The bindings are fixed. While the plugin is enabled, changing the pane focus or Pin chat bindings in the Keyboard shortcuts screen lasts only until the next reload. Disable or remove the plugin to keep your own keys. The written bindings stay after removal and can be reset from the same screen.
- It relies on app internals, not plugin APIs: an internal storage key for shortcut settings, and the command center opening on the All tab with Tab and Shift+Tab switching tabs. A Paseo update that changes either can make it stop working without an error.
- It works in the macOS desktop app and in the web app on a Mac. The iOS and Android apps are not changed.
- Written against Paseo 0.17.4.
