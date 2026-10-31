// Commits the built dist/ folder onto the gh-pages branch as a local commit.
// It never pushes - run "git push origin gh-pages" yourself when ready.
//
// Usage: bun run web:deploy (builds first, then commits)
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BRANCH = "gh-pages";
const WORKTREE = path.join(".gh-pages", "worktree");

function run(cmd) {
  return execSync(cmd, { stdio: "pipe" }).toString().trim();
}

function fail(message) {
  console.error(`gh-pages deploy: ${message}`);
  process.exit(1);
}

try {
  run(`git rev-parse --verify --quiet ${BRANCH}`);
} catch {
  fail(`no local branch "${BRANCH}". Create it once with: git branch ${BRANCH}`);
}

if (!fs.existsSync(path.join("dist", "index.html"))) {
  fail("dist/index.html is missing. Run the build first: bun run web:pwa");
}

// A stale worktree from an interrupted run blocks a new checkout.
try {
  run(`git worktree remove --force ${WORKTREE}`);
} catch {
  // Nothing to clean, or just directory leftovers.
  fs.rmSync(WORKTREE, { recursive: true, force: true });
}

run(`git worktree add ${WORKTREE} ${BRANCH}`);

try {
  // A CNAME on gh-pages carries a custom domain - keep if one is set.
  const keepCname = fs.existsSync(path.join(WORKTREE, "CNAME"));
  for (const entry of fs.readdirSync(WORKTREE)) {
    if (entry === ".git" || (keepCname && entry === "CNAME")) continue;
    fs.rmSync(path.join(WORKTREE, entry), { recursive: true, force: true });
  }

  for (const entry of fs.readdirSync("dist")) {
    fs.cpSync(path.join("dist", entry), path.join(WORKTREE, entry), { recursive: true });
  }

  run(`git -C ${WORKTREE} add -A`);
  if (!run(`git -C ${WORKTREE} status --porcelain`)) {
    console.log("gh-pages deploy: build is already committed, nothing to do.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  run(`git -C ${WORKTREE} commit -m "deploy web build ${stamp}"`);
  console.log("gh-pages deploy: committed. Push when ready with: git push origin gh-pages");
} finally {
  try {
    run(`git worktree remove --force ${WORKTREE}`);
  } catch {
    // Leave the worktree in place if cleanup fails; the next run clears it.
  }
}
