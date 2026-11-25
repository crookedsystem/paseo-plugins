import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginNewWorkspace } from "@getpaseo/plugin/client";
import { useSettings } from "@getpaseo/plugin/client";
import { Modal, TextInput, useToast } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  containsBranchPlaceholder,
  DEFAULT_WORKTREE_PATH_TEMPLATE,
  WORKTREE_PATH_METADATA_KEY,
  worktreePathSettings,
} from "../shared/worktree-path";
import { useWorktreePathPreviews } from "./use-worktree-path-previews";
import { listWorktreePathCandidates, normalizeBranchName } from "./worktree-path-candidates";

type WorktreeOptionsStyles = ReturnType<typeof createWorktreeOptionsStyles>;

// Edits the new worktree's branch name and path together. Applying a path that differs from the
// default then asks whether it should become the default as well.
export function WorktreeOptionsModal({
  theme,
  newWorkspace,
  close,
}: {
  theme: PluginTheme;
  newWorkspace: PluginNewWorkspace;
  close(): void;
}) {
  const settings = useSettings(worktreePathSettings);
  const toast = useToast();
  const defaultTemplate =
    settings.status === "ready" ? settings.values.worktreePathTemplate : DEFAULT_WORKTREE_PATH_TEMPLATE;
  const chosenTemplate = newWorkspace.metadata[WORKTREE_PATH_METADATA_KEY];
  const [typedBranchName, setTypedBranchName] = useState(newWorkspace.branch ?? "");
  const [typedTemplate, setTypedTemplate] = useState(
    typeof chosenTemplate === "string" ? chosenTemplate : defaultTemplate,
  );
  const [templateOfferedAsDefault, setTemplateOfferedAsDefault] = useState<string | null>(null);

  const branchName = normalizeBranchName(typedBranchName);
  const worktreePathTemplate = typedTemplate.trim() || defaultTemplate;
  const candidateTemplates = listWorktreePathCandidates(typedTemplate, defaultTemplate);
  const previewsByTemplate = useWorktreePathPreviews(newWorkspace.project?.id ?? null, branchName, [
    worktreePathTemplate,
    ...candidateTemplates,
  ]);
  const styles = createWorktreeOptionsStyles(theme);

  async function applyWorktreeOptions() {
    await newWorkspace.setBranch(branchName);
    const isDefaultTemplate = worktreePathTemplate === defaultTemplate;
    await newWorkspace.setMetadata({
      [WORKTREE_PATH_METADATA_KEY]: isDefaultTemplate ? null : worktreePathTemplate,
    });
    if (isDefaultTemplate) {
      close();
    } else {
      setTemplateOfferedAsDefault(worktreePathTemplate);
    }
  }

  async function saveTemplateAsDefault(template: string) {
    if (settings.status !== "ready") {
      return;
    }
    const isSaved = await settings.save({ ...settings.values, worktreePathTemplate: template }, settings.revision);
    if (isSaved) {
      toast.show("Default worktree path changed", { variant: "success" });
    } else {
      toast.error("Could not change the default worktree path");
    }
    close();
  }

  return (
    <Modal
      title={templateOfferedAsDefault === null ? "Worktree" : "Also change the default path?"}
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) close();
      }}
    >
      <Modal.Content>
        {templateOfferedAsDefault === null ? (
          <View style={styles.body}>
            <Text style={styles.label}>Branch name</Text>
            <TextInput
              value={typedBranchName}
              onChangeText={setTypedBranchName}
              placeholder="Automatic: named from the first prompt, or a random name"
              placeholderTextColor={theme.colors.foregroundMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void applyWorktreeOptions()}
              style={styles.input}
            />
            <Text style={styles.label}>Path, relative to the source repository</Text>
            <TextInput
              value={typedTemplate}
              onChangeText={setTypedTemplate}
              placeholder={defaultTemplate}
              placeholderTextColor={theme.colors.foregroundMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void applyWorktreeOptions()}
              style={styles.input}
            />
            <Text style={styles.hint}>
              {"{repo} is the repository folder name. {branch} is the branch name with / replaced by -."}
            </Text>
            <PathCandidateList
              candidateTemplates={candidateTemplates}
              selectedTemplate={worktreePathTemplate}
              previewsByTemplate={previewsByTemplate}
              selectTemplate={setTypedTemplate}
              styles={styles}
            />
            <Text style={styles.label}>Creates</Text>
            <Text style={styles.preview} selectable>
              {previewsByTemplate[worktreePathTemplate] ?? "…"}
            </Text>
            <View style={styles.buttons}>
              <DialogButton label="Cancel" onPress={close} styles={styles} />
              <DialogButton label="Apply" isPrimary onPress={() => void applyWorktreeOptions()} styles={styles} />
            </View>
          </View>
        ) : (
          <DefaultPathQuestion
            template={templateOfferedAsDefault}
            canBecomeDefault={containsBranchPlaceholder(templateOfferedAsDefault) && settings.status === "ready"}
            keepForThisWorktreeOnly={close}
            makeDefault={() => void saveTemplateAsDefault(templateOfferedAsDefault)}
            styles={styles}
          />
        )}
      </Modal.Content>
    </Modal>
  );
}

// Each candidate shows its template, and the absolute path it creates on its own line.
function PathCandidateList({
  candidateTemplates,
  selectedTemplate,
  previewsByTemplate,
  selectTemplate,
  styles,
}: {
  candidateTemplates: readonly string[];
  selectedTemplate: string;
  previewsByTemplate: Record<string, string>;
  selectTemplate(template: string): void;
  styles: WorktreeOptionsStyles;
}) {
  return (
    <View style={styles.candidateList}>
      {candidateTemplates.map((candidateTemplate) => (
        <Pressable
          key={candidateTemplate}
          accessibilityRole="button"
          accessibilityLabel={`Use ${candidateTemplate}`}
          onPress={() => selectTemplate(candidateTemplate)}
          style={candidateTemplate === selectedTemplate ? styles.selectedCandidate : styles.candidate}
        >
          <Text style={styles.candidateTemplate}>{candidateTemplate}</Text>
          <Text style={styles.candidatePath}>{previewsByTemplate[candidateTemplate] ?? "…"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DefaultPathQuestion({
  template,
  canBecomeDefault,
  keepForThisWorktreeOnly,
  makeDefault,
  styles,
}: {
  template: string;
  canBecomeDefault: boolean;
  keepForThisWorktreeOnly(): void;
  makeDefault(): void;
  styles: WorktreeOptionsStyles;
}) {
  return (
    <View style={styles.body}>
      <Text style={styles.message}>{`This worktree will use ${template}.`}</Text>
      <Text style={styles.message}>Use it for new worktrees from now on too?</Text>
      {canBecomeDefault ? null : (
        <Text style={styles.hint}>
          {"A default path must contain {branch}, or every worktree would get the same folder."}
        </Text>
      )}
      <View style={styles.buttons}>
        <DialogButton label="This worktree only" onPress={keepForThisWorktreeOnly} styles={styles} />
        {canBecomeDefault ? (
          <DialogButton label="Change default" isPrimary onPress={makeDefault} styles={styles} />
        ) : null}
      </View>
    </View>
  );
}

function DialogButton({
  label,
  isPrimary = false,
  onPress,
  styles,
}: {
  label: string;
  isPrimary?: boolean;
  onPress(): void;
  styles: WorktreeOptionsStyles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={isPrimary ? styles.primaryButton : styles.secondaryButton}
    >
      <Text style={isPrimary ? styles.primaryButtonText : styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function createWorktreeOptionsStyles(theme: PluginTheme) {
  const { colors } = theme;
  const candidate = {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  };
  const button = { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 };
  return {
    body: { gap: 10 },
    label: { color: colors.foreground, fontWeight: "600" as const },
    hint: { color: colors.foregroundMuted, fontSize: 12 },
    message: { color: colors.foreground },
    input: {
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    candidateList: { gap: 6 },
    candidate,
    selectedCandidate: { ...candidate, borderColor: colors.accent },
    candidateTemplate: { color: colors.foreground },
    candidatePath: { color: colors.foregroundMuted, fontSize: 12 },
    preview: { color: colors.foreground, fontSize: 12 },
    buttons: { flexDirection: "row" as const, justifyContent: "flex-end" as const, gap: 8 },
    secondaryButton: { ...button, borderWidth: 1, borderColor: colors.border },
    secondaryButtonText: { color: colors.foreground },
    primaryButton: { ...button, backgroundColor: colors.accent },
    primaryButtonText: { color: colors.accentForeground },
  };
}
