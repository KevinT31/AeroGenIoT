#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { execSync } = require("node:child_process");

const log = (msg) => process.stdout.write(`[apprunner-start] ${msg}\n`);

const required = ["DATABASE_URL"];
for (const key of required) {
  if (!process.env[key]) {
    process.stderr.write(`[apprunner-start] Missing required env: ${key}\n`);
    process.exit(1);
  }
}

try {
  log("Running prisma migrate deploy...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} catch (error) {
  process.stderr.write(`[apprunner-start] Migration failed: ${error.message}\n`);
  process.exit(1);
}

log("Starting NestJS API...");
const child = spawn("node", ["dist/main.js"], { stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code === null ? 1 : code);
});
