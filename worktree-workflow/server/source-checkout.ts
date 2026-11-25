import { homedir } from "node:os";
import { execCommand, type PluginHookContext } from "@getpaseo/plugin/server";

type PaseoApi = PluginHookContext["paseo"];

export async function resolveSourceCheckout(
  source: { cwd?: string; projectId?: string },
  paseo: PaseoApi,
) {
  const projectRootPath = source.cwd
    ? source.cwd.replace(/^~(?=$|\/)/, homedir())
    : await findProjectRootPath(source.projectId, paseo);
  const { stdout } = await execCommand("git", ["rev-parse", "--show-toplevel"], {
    cwd: projectRootPath,
  });
  return stdout.trim();
}

async function findProjectRootPath(projectId: string | undefined, paseo: PaseoApi) {
  const { projects } = await paseo.projects.list();
  const project = projects.find((candidate) => candidate.projectId === projectId);
  if (!project) {
    throw new Error(`project not found: ${projectId}`);
  }
  return project.projectRootPath;
}
