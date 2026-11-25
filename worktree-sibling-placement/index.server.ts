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
// 훅 전체 제한(30초) 안에 git 조회까지 끝나도록 LLM 호출에는 더 짧은 제한을 둔다.
const BRANCH_NAME_TIMEOUT_MS = 20_000;
const MAX_PROMPT_LENGTH = 2_000;
const MAX_BRANCH_NAME_LENGTH = 50;
const MAX_BRANCH_NAME_SUFFIX = 50;

type WorkspaceCreateRequest = PluginHookRequests["workspace.create.before"];
type WorktreeSource = Extract<WorkspaceCreateRequest["source"], { kind: "worktree" }>;

// 새 worktree를 원본 저장소 옆의 "<저장소명>__worktrees/<브랜치명의 / 를 - 로 바꾼 이름>"에 만든다.
// 예: ~/src/fanplus-api + feat/worktree → ~/src/fanplus-api__worktrees/feat-worktree
// 브랜치명을 정하지 않고 첫 프롬프트와 함께 만들면, worktree를 만들기 전에 프롬프트로 브랜치명을 지어 폴더명도 그 이름이 되게 한다.
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

// Paseo는 브랜치명이 비어 있으면 랜덤 이름으로 worktree를 만든 뒤 브랜치만 AI 이름으로 바꾼다.
// 그러면 폴더명은 랜덤 이름으로 남으므로, 여기서 미리 이름을 정해 Paseo의 나중 이름 변경을 건너뛰게 한다.
// 이름을 짓지 못하면 요청을 그대로 두어 기존 동작(랜덤 이름)으로 돌아간다.
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
  // 저장소별 Claude 설정을 읽지 않도록 임시 폴더에서 실행한다.
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

// 이미 있는 로컬 브랜치명을 넘기면 Paseo가 base가 아니라 그 브랜치에서 갈라지고,
// 이미 있는 폴더명이면 worktree 생성이 실패하므로 둘 다 비어 있는 이름을 고른다.
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
