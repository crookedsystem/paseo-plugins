import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useRef, useState } from "react";
import { previewWorktreePathRpc } from "../shared/worktree-path";

const PREVIEW_DEBOUNCE_MS = 250;

// Resolves each template to the absolute path the daemon would create, keyed by template.
// Requests wait until typing pauses, and a newer request replaces an older one.
export function useWorktreePathPreviews(
  projectId: string | null,
  branch: string | null,
  worktreePathTemplates: readonly string[],
) {
  const previewWorktreePath = useRpc(previewWorktreePathRpc);
  // Read through a ref so a new function identity from useRpc does not restart the requests.
  const latestPreviewWorktreePath = useRef(previewWorktreePath);
  latestPreviewWorktreePath.current = previewWorktreePath;
  const [previewsByTemplate, setPreviewsByTemplate] = useState<Record<string, string>>({});
  // The joined key stands in for the array, which callers rebuild on every render.
  const templatesKey = worktreePathTemplates.join("\n");

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }
    let isCancelled = false;
    const timer = setTimeout(async () => {
      const previewEntries = await Promise.all(
        templatesKey.split("\n").map(async (worktreePathTemplate) => {
          try {
            const { worktreePath } = await latestPreviewWorktreePath.current({
              projectId,
              worktreePathTemplate,
              branch,
            });
            return [worktreePathTemplate, worktreePath] as const;
          } catch {
            return [worktreePathTemplate, "Preview unavailable"] as const;
          }
        }),
      );
      if (!isCancelled) {
        setPreviewsByTemplate(Object.fromEntries(previewEntries));
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [projectId, branch, templatesKey]);

  return previewsByTemplate;
}
