#!/usr/bin/env node
/**
 * Build all workspace packages required by the Next.js app.
 *
 * Designed to fail loudly on Vercel with diagnostic output if a submodule
 * (Vibe-Workflow, Open-Poe-AI) is missing or a build silently produces no dist.
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

const PACKAGES = [
  {
    name: "workflow-builder",
    dir: "packages/Vibe-Workflow/packages/workflow-builder",
    expect: "dist/tailwind.css",
  },
  {
    name: "ai-agent",
    dir: "packages/Open-Poe-AI/packages/agents",
    expect: "dist/tailwind.css",
  },
  {
    name: "studio",
    dir: "packages/studio",
    expect: "dist/tailwind.css",
  },
];

function log(...args) {
  console.log("[build-packages]", ...args);
}

function fail(msg) {
  console.error("[build-packages] FATAL:", msg);
  process.exit(1);
}

log("CWD:", ROOT);
log("Top-level packages/ contents:");
try {
  for (const entry of fs.readdirSync(path.join(ROOT, "packages"))) {
    log("  -", entry);
  }
} catch (e) {
  fail("packages/ directory missing: " + e.message);
}

for (const pkg of PACKAGES) {
  const abs = path.join(ROOT, pkg.dir);
  const pkgJson = path.join(abs, "package.json");

  log(`\n=== ${pkg.name} ===`);
  log("Expected dir:", abs);

  if (!fs.existsSync(abs)) {
    fail(
      `${pkg.dir} does not exist. ` +
        `If this is a submodule (Vibe-Workflow / Open-Poe-AI), Vercel did not check it out. ` +
        `Verify the submodule is registered in the git index and that submodule cloning is enabled.`
    );
  }

  if (!fs.existsSync(pkgJson)) {
    fail(`${pkg.dir}/package.json missing — directory exists but is empty (submodule not cloned?).`);
  }

  log("Running: pnpm --filter ./" + pkg.dir + " run build");
  try {
    execSync(`pnpm --filter ./${pkg.dir} run build`, {
      stdio: "inherit",
      cwd: ROOT,
    });
  } catch (e) {
    fail(`build failed for ${pkg.name}: ${e.message}`);
  }

  const expectAbs = path.join(abs, pkg.expect);
  if (!fs.existsSync(expectAbs)) {
    fail(`${pkg.name} build completed but expected output missing: ${expectAbs}`);
  }
  log("OK ->", expectAbs);
}

log("\nAll workspace packages built successfully.");
