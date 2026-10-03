#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const appDir = path.resolve(__dirname, "..");
const label = process.env.AEROGEN_START_LABEL || "local-start";

const log = (message) => process.stdout.write(`[${label}] ${message}\n`);
const fail = (message) => {
  process.stderr.write(`[${label}] ${message}\n`);
  process.exit(1);
};

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = stripQuotes(trimmed.slice(separator + 1));
    if (!process.env[key]) process.env[key] = value;
  }
  log(`Loaded env from ${path.relative(appDir, filePath)}`);
  return true;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: appDir,
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

const preferredEnvFile = process.env.AEROGEN_ENV_FILE || ".env.floci";
const envCandidates = [
  path.resolve(appDir, preferredEnvFile),
  path.resolve(appDir, ".env"),
  path.resolve(appDir, ".env.example"),
];

const loaded = envCandidates.some(loadEnvFile);
if (!loaded) {
  log("No env file found; using process environment only.");
}

if (!process.env.DATABASE_URL) {
  fail("Missing required env: DATABASE_URL");
}

const distMain = path.resolve(appDir, "dist", "main.js");
if (process.env.AEROGEN_REBUILD === "true" || !fs.existsSync(distMain)) {
  log("Building NestJS API...");
  run("npm", ["run", "build"]);
}

const databaseUrl = process.env.DATABASE_URL || "";
const syncMode = String(
  process.env.PRISMA_DB_SYNC_MODE || (databaseUrl.startsWith("mysql://") ? "push" : "migrate"),
).toLowerCase();

if (syncMode === "none") {
  log("Skipping Prisma schema sync.");
} else if (syncMode === "push") {
  log("Running prisma db push...");
  run("npx", ["prisma", "db", "push", "--skip-generate"]);
} else {
  log("Running prisma migrate deploy...");
  run("npx", ["prisma", "migrate", "deploy"]);
}

log("Starting NestJS API...");
const child = spawn("node", ["dist/main.js"], {
  cwd: appDir,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code === null ? 1 : code);
});
