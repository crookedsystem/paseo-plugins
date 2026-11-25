import { useSettings } from "@getpaseo/plugin/client";
import {
  Loading,
  SettingsAction,
  SettingsInput,
  type SettingsInputHandle,
  SettingsRow,
  SettingsSection,
} from "@getpaseo/plugin/client/ui";
import { useRef, useState } from "react";
import {
  DEFAULT_WORKTREE_PATH_TEMPLATE,
  defaultWorktreePathTemplateSchema,
  worktreePathSettings,
} from "../shared/worktree-path";

const TEMPLATE_HINT =
  "Relative to the source repository. {repo} is the repository folder name and {branch} is the branch name with / replaced by -.";

export function WorktreePathSettingsScreen() {
  const settings = useSettings(worktreePathSettings);
  const templateInput = useRef<SettingsInputHandle>(null);
  const [draftTemplate, setDraftTemplate] = useState<string | null>(null);

  if (settings.status === "loading") {
    return <Loading />;
  }
  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Worktree path">
        <SettingsAction
          label="The saved settings cannot be read"
          error={settings.error}
          actionLabel="Reset"
          onPress={() => void settings.reset()}
        />
      </SettingsSection>
    );
  }

  const savedTemplate = settings.values.worktreePathTemplate;
  const editedTemplate = (draftTemplate ?? savedTemplate).trim();
  const validation = defaultWorktreePathTemplateSchema.safeParse(editedTemplate);
  const validationError = validation.success ? null : (validation.error.issues[0]?.message ?? null);

  async function restoreDefaultTemplate() {
    const isReset = await settings.reset();
    if (isReset) {
      templateInput.current?.replaceText(DEFAULT_WORKTREE_PATH_TEMPLATE);
      setDraftTemplate(null);
    }
  }

  return (
    <SettingsSection title="Worktree path">
      <SettingsInput
        ref={templateInput}
        label="Default path"
        hint={TEMPLATE_HINT}
        initialValue={savedTemplate}
        placeholder={DEFAULT_WORKTREE_PATH_TEMPLATE}
        onChangeText={setDraftTemplate}
        error={validationError ?? settings.saveError}
        disabled={settings.saving}
      />
      <SettingsAction
        label="Save the default path"
        actionLabel="Save"
        disabled={validationError !== null || editedTemplate === savedTemplate || settings.saving}
        onPress={() =>
          void settings.save({ ...settings.values, worktreePathTemplate: editedTemplate }, settings.revision)
        }
      />
      <SettingsRow label="Built-in default" hint={DEFAULT_WORKTREE_PATH_TEMPLATE} />
      <SettingsAction
        label="Restore the built-in default"
        actionLabel="Restore"
        disabled={savedTemplate === DEFAULT_WORKTREE_PATH_TEMPLATE || settings.saving}
        onPress={() => void restoreDefaultTemplate()}
      />
    </SettingsSection>
  );
}
