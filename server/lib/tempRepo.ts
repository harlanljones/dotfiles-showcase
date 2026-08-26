import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type GitState = "none" | "rebase" | "merge";

export interface PromptState {
  branch?: string;
  dirty?: boolean;
  ahead?: number;
  behind?: number;
  detached?: boolean;
  state?: GitState;
  width?: number;
  ssh?: boolean;
  status?: number;
  durationMs?: number;
  shell?: "zsh" | "bash";
  /** TC-01 opt-in: render with true_color=true and recolor truecolor cyan→red (proposed-fix preview). */
  trueColor?: boolean;
}

export interface BuiltRepo {
  path: string;
  cleanup: () => void;
}

function safeBranch(b: string): string {
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(b)) {
    throw new Error(`invalid branch name: ${JSON.stringify(b)}`);
  }
  return b;
}

function run(cwd: string, args: string): void {
  execSync(`git ${args}`, { cwd, stdio: "pipe" });
}

// Build an isolated temporary git repository that reflects the requested shell
// state, so the REAL `starship` binary renders exactly what it would for that
// state. This is the core of the Starship Playground's fidelity.
export function buildTempRepo(state: PromptState): BuiltRepo {
  const path = mkdtempSync(join(tmpdir(), "starship-showcase-"));
  const upstream = mkdtempSync(join(tmpdir(), "starship-upstream-"));
  const cleanup = () => {
    rmSync(path, { recursive: true, force: true });
    rmSync(upstream, { recursive: true, force: true });
  };

  try {
    // Bare upstream so we can simulate ahead/behind via a real remote.
    run(upstream, "init -q --bare");

    run(path, "init -q -b main");
    run(path, "config user.email showcase@local");
    run(path, "config user.name showcase");
    run(path, "config commit.gpgsign false");
    writeFileSync(join(path, "f"), "base\n");
    run(path, "add -A");
    run(path, "commit -qm base");

    const branch = safeBranch(state.branch ?? "main");
    if (branch !== "main") run(path, `checkout -qb ${branch}`);

    run(path, `remote add origin ${upstream}`);
    run(path, "push -u origin HEAD 2>/dev/null");

    // Ahead: local commits the upstream does not have.
    for (let i = 0; i < (state.ahead ?? 0); i++) {
      writeFileSync(join(path, `ahead-${i}`), `${i}\n`);
      run(path, "add -A");
      run(path, `commit -qm ahead-${i}`);
    }

    // Behind: the upstream gains commits the local branch lacks.
    if ((state.behind ?? 0) > 0) {
      const c2 = mkdtempSync(join(tmpdir(), "starship-c2-"));
      try {
        run(c2, `clone -q ${upstream} .`);
        run(c2, "checkout -q main");
        run(c2, "config user.email showcase@local");
        run(c2, "config user.name showcase");
        run(c2, "config commit.gpgsign false");
        for (let i = 0; i < (state.behind ?? 0); i++) {
          writeFileSync(join(c2, `behind-${i}`), `${i}\n`);
          run(c2, "add -A");
          run(c2, `commit -qm behind-${i}`);
        }
        run(c2, "push -q origin HEAD");
      } finally {
        rmSync(c2, { recursive: true, force: true });
      }
      run(path, "fetch -q origin");
    }

    if (state.dirty) {
      // Untracked file -> matches `^\?\?`; modified tracked file -> matches `.[MT]`
      // (both trigger custom.git_dirty per starship.toml:37).
      writeFileSync(join(path, "dirty.txt"), "changed\n");
      writeFileSync(join(path, "f"), "modified\n");
    }

    if (state.detached) {
      const hash = execSync("git rev-parse HEAD", { cwd: path })
        .toString()
        .trim();
      run(path, `checkout -q ${hash}`);
    }

    if (state.state === "rebase") {
      const git = join(path, ".git");
      const dir = join(git, "rebase-merge");
      mkdirSync(dir, { recursive: true });
      const head = execSync("git rev-parse HEAD", { cwd: path })
        .toString()
        .trim();
      writeFileSync(join(dir, "head-name"), `refs/heads/${branch}\n`);
      writeFileSync(join(dir, "onto"), `${head}\n`);
      writeFileSync(join(dir, "msgnum"), "1\n");
      writeFileSync(join(dir, "end"), "1\n");
      writeFileSync(join(dir, "orig-head"), `${head}\n`);
    } else if (state.state === "merge") {
      const head = execSync("git rev-parse HEAD", { cwd: path })
        .toString()
        .trim();
      writeFileSync(join(path, ".git", "MERGE_HEAD"), `${head}\n`);
    }

    return { path, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}
