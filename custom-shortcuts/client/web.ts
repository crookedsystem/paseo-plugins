import { Platform } from "react-native";

// Only the DOM members this module uses. The plugin tsconfig has no DOM lib.
interface KeyPress {
  key: string;
  code: string;
  metaKey?: boolean;
  shiftKey?: boolean;
}
declare class KeyboardEvent {
  constructor(type: "keydown", init: KeyPress & { bubbles: boolean; cancelable: boolean });
  readonly code: string;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly repeat: boolean;
  preventDefault(): void;
}
declare const window: {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void, capture: boolean): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void, capture: boolean): void;
  dispatchEvent(event: KeyboardEvent): boolean;
  requestAnimationFrame(callback: () => void): number;
};
declare const document: { querySelector(selector: string): unknown };
declare const localStorage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

// The app keeps user shortcut bindings under this key. It is an internal app
// storage key, not a plugin API, so an app update can rename it.
const overrideStorageKey = "@paseo:keyboard-shortcut-overrides";

export type ShortcutOverrides = Record<string, string | null>;

function readStoredOverrides(): ShortcutOverrides {
  try {
    const storedOverrides = localStorage.getItem(overrideStorageKey);
    return storedOverrides ? JSON.parse(storedOverrides) : {};
  } catch {
    return {};
  }
}

// Merges the given bindings into the stored overrides and leaves every other
// binding the user set untouched. A null value unbinds the shortcut. Native apps
// keep shortcuts elsewhere, so this does nothing outside the web build.
export function mergeShortcutOverrides(overrides: ShortcutOverrides): void {
  if (Platform.OS !== "web") return;
  const mergedOverrides = { ...readStoredOverrides(), ...overrides };
  localStorage.setItem(overrideStorageKey, JSON.stringify(mergedOverrides));
}

export type CommandCenterTab = "workspaces" | "actions";

export interface CommandCenterTabShortcut {
  // KeyboardEvent.code of the letter pressed together with Cmd+Shift, e.g. "KeyO".
  code: string;
  tab: CommandCenterTab;
}

// The app has no shortcut action that opens the command center on a given tab.
// It always opens on the All tab, and Tab / Shift+Tab rotate through
// all, workspaces, files and actions with wrap-around, so one press reaches
// either neighbour of All.
const tabKeyPresses: Record<CommandCenterTab, KeyPress> = {
  workspaces: { key: "Tab", code: "Tab" },
  actions: { key: "Tab", code: "Tab", shiftKey: true },
};
const toggleCommandCenterKeyPress: KeyPress = { key: "k", code: "KeyK", metaKey: true };
const commandCenterInputSelector = "[data-testid='command-center-input']";
const maxFramesToWait = 60;

function pressKey(keyPress: KeyPress): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { ...keyPress, bubbles: true, cancelable: true }));
}

function isCommandCenterOpen(): boolean {
  return document.querySelector(commandCenterInputSelector) !== null;
}

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitUntil(condition: () => boolean): Promise<boolean> {
  for (let frame = 0; frame < maxFramesToWait; frame += 1) {
    if (condition()) return true;
    await waitForFrame();
  }
  return condition();
}

// Toggles the command center through the app's own Cmd+K handler. An open
// command center is closed first so it reopens on the All tab.
async function openCommandCenterTab(tab: CommandCenterTab): Promise<void> {
  if (isCommandCenterOpen()) {
    pressKey(toggleCommandCenterKeyPress);
    const isClosed = await waitUntil(() => !isCommandCenterOpen());
    if (!isClosed) return;
  }
  pressKey(toggleCommandCenterKeyPress);
  const isOpened = await waitUntil(isCommandCenterOpen);
  if (!isOpened) {
    console.warn(`[custom-shortcuts] command center did not open, ${tab} tab skipped`);
    return;
  }
  // The command center registers its key handler in the commit that shows the
  // input, so one more frame makes sure the Tab press reaches it.
  await waitForFrame();
  pressKey(tabKeyPresses[tab]);
}

function isCmdShiftOnly(event: KeyboardEvent): boolean {
  return event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey;
}

// Listens for Cmd+Shift+<letter> and opens the matching command center tab.
// Returns the cleanup that removes the listener.
export function listenForCommandCenterTabShortcuts(shortcuts: CommandCenterTabShortcut[]): () => void {
  if (Platform.OS !== "web") return () => {};
  const openTabOnShortcut = (event: KeyboardEvent) => {
    if (event.repeat || !isCmdShiftOnly(event)) return;
    const matchedShortcut = shortcuts.find((shortcut) => shortcut.code === event.code);
    if (!matchedShortcut) return;
    event.preventDefault();
    void openCommandCenterTab(matchedShortcut.tab);
  };
  window.addEventListener("keydown", openTabOnShortcut, true);
  return () => window.removeEventListener("keydown", openTabOnShortcut, true);
}
