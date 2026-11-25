import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  execCommand,
  type PluginHookContext,
  type PluginHookRequests,
  type PluginServerContext,
} from "@getpaseo/plugin/server";

const BRANCH_NAME_MODEL = "haiku";
// The whole hook has 30 seconds, so the LLM call gets a shorter limit to leave room for the git lookups.
const BRANCH_NAME_TIMEOUT_MS = 20_000;
const MAX_PROMPT_LENGTH = 2_000;
const MAX_BRANCH_NAME_LENGTH = 50;
const MAX_BRANCH_NAME_SUFFIX = 50;

type WorkspaceCreateRequest = PluginHookRequests["workspace.create.before"];
type WorktreeSource = Extract<WorkspaceCreateRequest["source"], { kind: "worktree" }>;

// Creates new worktrees next to the source checkout at "<repo>__worktrees/<branch with / replaced by ->".
// Example: ~/src/fanplus-api + feat/worktree → ~/src/fanplus-api__worktrees/feat-worktree
// When a worktree is created with a first prompt but no branch name, the branch is named from that prompt
// before the worktree exists, so the folder gets the same name.
export default function contribute(server: PluginServerContext) {
  const removeBranchNameHook = server.addHook(
    "workspace.create.before",
    async ({ request }, context) => nameBranchFromFirstPrompt(request, context),
  );
  const removePlacementHook = server.addHook("worktree.create.before", async ({ request }) => {
    const worktreeDirectoryName = request.branch.replaceAll("/", "-");
    const path = join(resolveWorktreesRoot(request.sourceCheckout), worktreeDirectoryName);
    console.log(`worktree path: ${request.branch} → ${path}`);
    return { ...request, path };
  });
  return () => {
    removeBranchNameHook();
    removePlacementHook();
  };
}

function resolveWorktreesRoot(sourceCheckout: string) {
  return join(dirname(sourceCheckout), `${basename(sourceCheckout)}__worktrees`);
}

// Without a branch name, Paseo creates the worktree under a random name and later renames only the branch.
// The folder would keep the random name, so the name is chosen here, which makes Paseo skip its later rename.
// If no name can be chosen, the request is returned unchanged and Paseo falls back to its random name.
async function nameBranchFromFirstPrompt(
  request: WorkspaceCreateRequest,
  { paseo, signal }: PluginHookContext,
) {
  const { source } = request;
  const firstPrompt = request.firstAgentContext?.prompt?.trim();
  if (source.kind !== "worktree" || !firstPrompt || !createsNewUnnamedBranch(source)) {
    return undefined;
  }
  try {
    const sourceCheckout = await resolveSourceCheckout(source, paseo);
    const generatedBranchName = await generateBranchNameFromPrompt(firstPrompt, signal);
    const branchName = await findUnusedBranchName(sourceCheckout, generatedBranchName);
    console.log(`branch name from first prompt: ${branchName}`);
    return { ...request, source: { ...source, branchName } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`branch name from first prompt skipped: ${reason}`);
    return undefined;
  }
}

function createsNewUnnamedBranch(source: WorktreeSource) {
  const checksOutExistingRef =
    source.action === "checkout" ||
    source.checkoutSource !== undefined ||
    source.githubPrNumber !== undefined;
  return source.branchName === undefined && !checksOutExistingRef;
}

async function resolveSourceCheckout(
  source: WorktreeSource,
  paseo: PluginHookContext["paseo"],
) {
  const projectRootPath = source.cwd
    ? source.cwd.replace(/^~(?=$|\/)/, homedir())
    : await findProjectRootPath(source.projectId, paseo);
  const { stdout } = await execCommand("git", ["rev-parse", "--show-toplevel"], {
    cwd: projectRootPath,
  });
  return stdout.trim();
}

async function findProjectRootPath(
  projectId: string | undefined,
  paseo: PluginHookContext["paseo"],
) {
  const { projects } = await paseo.projects.list();
  const project = projects.find((candidate) => candidate.projectId === projectId);
  if (!project) {
    throw new Error(`project not found: ${projectId}`);
  }
  return project.projectRootPath;
}

async function generateBranchNameFromPrompt(firstPrompt: string, signal: AbortSignal) {
  const instruction = [
    "Return only a git branch name for the task below.",
    "Use lowercase kebab-case ASCII, at most 5 words, and no prefix such as feat/.",
    "Task:",
    firstPrompt.slice(0, MAX_PROMPT_LENGTH),
  ].join("\n");
  // Run from a temporary directory so no repository-specific Claude settings are loaded.
  const { stdout } = await execCommand(
    "claude",
    ["-p", "--model", BRANCH_NAME_MODEL, "--no-session-persistence", instruction],
    { cwd: tmpdir(), timeout: BRANCH_NAME_TIMEOUT_MS, signal },
  );
  const lastOutputLine = stdout.trim().split("\n").at(-1) ?? "";
  const branchName = toBranchSlug(lastOutputLine);
  if (!branchName) {
    throw new Error(`unusable branch name: ${JSON.stringify(lastOutputLine)}`);
  }
  return branchName;
}

function toBranchSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_BRANCH_NAME_LENGTH)
    .replace(/^-+|-+$/g, "");
}

// An existing local branch name makes Paseo branch off that branch instead of the base,
// and an existing folder makes worktree creation fail, so pick a name that is free on both sides.
async function findUnusedBranchName(sourceCheckout: string, desiredBranchName: string) {
  const worktreesRoot = resolveWorktreesRoot(sourceCheckout);
  for (let suffix = 1; suffix <= MAX_BRANCH_NAME_SUFFIX; suffix++) {
    const candidate = suffix === 1 ? desiredBranchName : `${desiredBranchName}-${suffix}`;
    const isFolderTaken = existsSync(join(worktreesRoot, candidate));
    if (!isFolderTaken && !(await localBranchExists(sourceCheckout, candidate))) {
      return candidate;
    }
  }
  throw new Error(`no unused branch name for ${desiredBranchName}`);
}

async function localBranchExists(sourceCheckout: string, branchName: string) {
  try {
    await execCommand("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
      cwd: sourceCheckout,
    });
    return true;
  } catch {
    return false;
  }
}
