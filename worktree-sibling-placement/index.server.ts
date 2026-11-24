import { basename, dirname, join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";

// 새 worktree를 원본 저장소 옆의 "<저장소명>__worktrees/<브랜치명의 / 를 - 로 바꾼 이름>"에 만든다.
// 예: ~/src/fanplus-api + feat/worktree → ~/src/fanplus-api__worktrees/feat-worktree
export default function contribute(server: PluginServerContext) {
  return server.addHook("worktree.create.before", async ({ request }) => {
    const worktreesRoot = join(
      dirname(request.sourceCheckout),
      `${basename(request.sourceCheckout)}__worktrees`,
    );
    const worktreeDirectoryName = request.branch.replaceAll("/", "-");
    const path = join(worktreesRoot, worktreeDirectoryName);
    console.log(`worktree path: ${request.branch} → ${path}`);
    return { ...request, path };
  });
}
