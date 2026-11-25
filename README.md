# paseo-plugins

Personal [Paseo](https://paseo.sh) plugins. Each plugin lives in its own folder.

| Plugin | What it does |
|---|---|
| [`worktree-workflow`](./worktree-workflow) | Lets you name a new worktree's branch and choose its path, names the branch from the first prompt otherwise, and creates the worktree at a configurable path relative to the source repository (default `../<repo>__worktrees/<branch>`) |
| [`custom-shortcuts`](./custom-shortcuts) | Adds macOS shortcuts: pane focus that works from the composer, and command center Workspaces/Actions tabs |

## custom-shortcuts

A client plugin for the macOS desktop app (and the web app on a Mac). See [`OVERVIEW.md`](./custom-shortcuts/OVERVIEW.md) for the user-facing description.

| Shortcut | What it does | How |
|---|---|---|
| `Cmd+Option+Arrow` | Focus pane left/right/up/down, also from the composer | Writes user overrides into the app's shortcut settings. Default `Cmd+Shift+Arrow` bindings are ignored in text fields; user overrides drop that condition |
| `Cmd+Shift+O` | Opens the command center on the Workspaces tab | Listens for the key and sends the app `Cmd+K`, then `Tab` |
| `Cmd+Shift+P` | Opens the command center on the Actions tab | Same, with `Shift+Tab`. Pin chat's default `Cmd+Shift+P` is unbound (`null` override) |

- Both parts rely on app internals, not plugin APIs: the storage key `@paseo:keyboard-shortcut-overrides` (localStorage), and the command center opening on the All tab with `Tab`/`Shift+Tab` rotating `all → workspaces → files → actions`. A Paseo update can break them silently. These were read from the Paseo 0.17.4 app bundle.
- Other custom shortcuts are kept. The plugin's overrides are rewritten on every load, so changing them in the Keyboard shortcuts screen does not last while the plugin is enabled.
- The app may read its settings before the plugin writes them. After installing, reload the app window (`Cmd+R`) once or twice until the new keys appear under Help and support → Keyboard shortcuts.
- Removing the plugin keeps the overrides it already wrote. Use Reset to default in the Keyboard shortcuts screen to undo them.

Install it the same way as below, from the `custom-shortcuts` folder.

## worktree-workflow

### Worktree placement

By default Paseo creates worktrees at `~/.paseo/worktrees/<hash>/<random slug>/`. The `worktree.create.before` hook moves them to a path template resolved relative to the source repository. The built-in default, `../{repo}__worktrees/{branch}`, puts them in a `__worktrees` folder next to the source repository, named after the branch. `{repo}` is the repository folder name, and `{branch}` is the branch name with `/` replaced by `-`.

```
~/Documents/github/fan-maum/
  fanplus-api/                         ← source repository
  fanplus-api__worktrees/
    feat-cms-star-many-to-many/        ← branch feat/cms-star-many-to-many
    feat-cms-person-api/               ← branch feat/cms-person-api
```

- Applies to every way Paseo creates a worktree: the app, the CLI, MCP, and agent creation. Every project registered on this daemon is affected.
- Change the default under **Settings → Plugins → Worktree workflow → Worktree path**. The default must contain `{branch}`, or every worktree would get the same folder. **Restore** goes back to the built-in default. The setting is stored on the daemon and applies to every project.
- If the path already exists, worktree creation fails. Paseo does not add a suffix to a path a plugin chose. To recreate a worktree for the same branch, clean up the old one first.

### Worktree field

The New workspace screen gets a **Worktree** field. Its label shows the current branch name and path, such as `feat/login · .worktrees/{branch}`. Pressing it opens a dialog that edits both.

- **Branch name**: the new worktree is created on this branch, and its folder gets the same name. Leave it empty to have it named from the first prompt or by Paseo. Whitespace becomes `-`, because git rejects branch names with spaces. A name you type is used as is: if a local branch with that name already exists, Paseo branches off that branch instead of the base, and if its folder already exists, creation fails.
- **Path**: a one-off path template relative to the source repository. The dialog lists the saved default and common relative paths (`../{repo}__worktrees/{branch}`, `.worktrees/{branch}`, `../{repo}-{branch}`). A typed path without `{branch}` is also offered as a parent folder, so typing `../wt` offers `../wt/{branch}`. Each option shows the absolute path it creates on its own line, and **Creates** shows the path for the current input.
- **Apply**, or Enter in either input, applies both. A path that differs from the default then asks whether to make it the default too. A path without `{branch}` can be used once but not as the default.
- The field is disabled when the workspace is not a worktree or when a PR is the base, because Paseo ignores the branch name in those cases. Paseo clears the choices when you change the host or the project.
- The one-off path applies only when the branch name is known before the worktree is created: you typed it, or it was named from the first prompt. When Paseo picks a random name instead, the default path is used and `worktree path override skipped` is logged.

### Branch name from the first prompt

When a worktree is created with a first prompt but no branch name, the plugin asks `claude -p --model haiku` for a branch name (e.g. `fix-worktree-auto-branch-name`) before the worktree exists, and uses it for both the branch and the folder. If a local branch or folder with that name already exists, it appends `-2`, `-3`, and so on.

- Paseo also names branches with AI, but it first creates the worktree under a random name (e.g. `tranquil-newt`) and then renames only the branch. Without this plugin, the folder keeps the random name.
- If the daemon cannot find the `claude` CLI, the call takes longer than 20 seconds, or the reply is not a usable name, the folder gets Paseo's random branch name. The reason is logged as a `branch name from first prompt skipped: …` line in `paseo plugin logs worktree-workflow`.
- No name is generated when there is no first prompt, when you typed a branch name, or when an existing branch or PR is checked out.

### Notes

- To show workspaces by branch name in the sidebar, choose Title → Branch name in the sidebar display preferences. Paseo shows the branch name for every workspace, including existing ones.
- Besides the disk path, the plugin changes only the branch name and a `worktreeWorkflow.worktreePathTemplate` entry in the workspace metadata when a one-off path is chosen.
- Requires Paseo `>=0.17.4` (`requirements.paseo` in `paseo-plugin.json`).

### Layout

```
worktree-workflow/
  paseo-plugin.json
  index.client.tsx                ← registers the Worktree field and the settings screen (app)
  client/worktree-field.tsx
  client/worktree-options-modal.tsx
  client/worktree-path-candidates.ts
  client/use-worktree-path-previews.ts
  client/worktree-path-settings-screen.tsx
  index.server.ts                 ← registers the settings, the path preview RPC, and both hooks (daemon)
  server/branch-name-from-prompt.ts
  server/source-checkout.ts
  server/worktree-path.ts
  server/worktree-path-overrides.ts
  shared/worktree-path.ts         ← path template, settings definition, and RPC contract
```

## Install on this machine

Plugins are installed per daemon, and plugin support must be turned on once per daemon. Plugin code runs unsandboxed with access to the daemon machine's files, processes, and credentials, so only install code you have reviewed.

```bash
# Turn on plugins. Same as Settings → Plugins → Enable plugins in the app
#   set "pluginsEnabled": true at the top level of ~/.paseo/config.json, then
paseo reload --json          # applied when appliedPaths includes pluginsEnabled

# Install the plugin. Always pass an absolute path
cd ~/Documents/github/crookedbot/crookedsystem/paseo-plugins/worktree-workflow
npm install                  # development dependencies for type checking; not needed at runtime
npm run typecheck
paseo plugin install "$PWD"

paseo plugin ls              # STATUS should be running
```

When installed from a local path, Paseo runs the code in place instead of copying it (the DIRECTORY column of `paseo plugin ls` is this folder).

Register this repository as a Paseo project to edit it with agents from the app.

```bash
paseo project create ~/Documents/github/crookedbot/crookedsystem/paseo-plugins
```

### Migrating from worktree-sibling-placement

This plugin used to be called `worktree-sibling-placement`. The runtime ID changed, so remove the old installation and install the new folder. The old plugin has no settings, so nothing is lost.

```bash
paseo plugin remove worktree-sibling-placement
cd ~/Documents/github/crookedbot/crookedsystem/paseo-plugins/worktree-workflow
npm install && npm run typecheck
paseo plugin install "$PWD"
paseo plugin ls              # worktree-workflow should be running
```

Do the same on every other machine that installed the old plugin.

## Use on another machine

First check which daemon creates worktrees for that machine. The hooks run only on the daemon that creates the worktree, and the branch name field comes from that daemon too.

### The machine uses its own daemon

Install the plugin on that daemon as well. If you plan to edit the plugin, clone the repository and install from the local path.

```bash
git clone git@github.com:crookedsystem/paseo-plugins.git ~/Documents/github/crookedbot/crookedsystem/paseo-plugins
cd ~/Documents/github/crookedbot/crookedsystem/paseo-plugins/worktree-workflow
npm install && npm run typecheck
paseo plugin install "$PWD"
paseo project create ~/Documents/github/crookedbot/crookedsystem/paseo-plugins   # optional
```

That machine also needs the `pluginsEnabled` setting and `paseo reload` above. Apply later changes with `git pull`, then `paseo plugin reload worktree-workflow`.

If you will not edit it, you can install straight from git. Paseo downloads it into a folder it manages (under `~/.paseo/plugins/`). `update` and `remove` overwrite or delete that folder, so do not edit there.

```bash
paseo plugin add git:crookedsystem/paseo-plugins:worktree-workflow
paseo plugin update worktree-workflow   # apply later changes
```

For a private repository, that machine's daemon needs git access (an SSH key, for example).

The `owner/slug` form, as in `paseo plugin add roundreddot/better-paseo`, works only for plugins in the [Paseo plugin registry](https://paseo.sh/plugins). This plugin is not in the registry, so use the `git:` form above.

### The machine connects to this Mac's daemon remotely

Nothing to install. Worktrees are created by this Mac's daemon, and the hooks run here.

## Editing and applying changes

Do not restart the daemon. A restart disconnects running agents.

```bash
cd ~/Documents/github/crookedbot/crookedsystem/paseo-plugins/worktree-workflow
# edit the files
npm run typecheck
paseo plugin reload worktree-workflow
paseo plugin ls                                    # check it is running
paseo plugin logs worktree-workflow                # check the "worktree path: <branch> → <path>" log
```

Edit the plugin in this repository's source folder (the local workspace). The installed plugin runs from that folder, so changes made in one of this repository's Paseo worktrees take effect only after they are merged into the source folder and the plugin is reloaded.

## Troubleshooting

If a hook throws, worktree creation stops. A broken plugin blocks worktree creation in every project, so turn the plugin off first and then look for the cause.

```bash
paseo plugin disable worktree-workflow    # Paseo falls back to its default location
paseo plugin logs worktree-workflow       # check the error output
paseo plugin ls                           # check the ERROR column
# after fixing it in the source folder
npm run typecheck
paseo plugin enable worktree-workflow
```

To remove it completely, run `paseo plugin remove worktree-workflow`. A plugin installed from a local path keeps its source folder.

## References

- [Plugin hooks](https://paseo.sh/docs/plugins/hooks.md)
- [Plugins](https://paseo.sh/docs/plugins.md)
- [Plugin reference](https://paseo.sh/docs/plugins/reference.md)
- [Publishing](https://paseo.sh/docs/plugins/publishing.md)
- [Worktrees](https://paseo.sh/docs/worktrees.md)
