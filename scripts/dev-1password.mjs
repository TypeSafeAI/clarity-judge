#!/usr/bin/env node
/**
 * Runs Next with the TypeSafe key read from 1Password at launch, so no plaintext
 * key needs to sit on disk waiting to go stale.
 *
 *   pnpm dev            # reads TYPESAFE_API_KEY from .env.local (plaintext)
 *   pnpm dev:1password  # reads it from 1Password; nothing is written to disk
 *
 * Both paths work, and they can coexist. An environment variable that is already
 * set takes precedence over .env.local in Next's loader, so the key injected here
 * wins even when a plaintext one is present. That was measured against this
 * project's own @next/env, not assumed.
 *
 * Any arguments are passed to next, defaulting to `dev`:
 *
 *   node scripts/dev-1password.mjs             -> next dev
 *   node scripts/dev-1password.mjs dev -p 4000 -> next dev -p 4000
 *   node scripts/dev-1password.mjs start       -> next start
 *
 * Point it at a different item with TYPESAFE_OP_REF=op://<vault>/<item>/<field>.
 * A secret reference is not a secret, so the default below is safe to commit.
 *
 * No dependencies, matching the other scripts here.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

const REFERENCE = process.env.TYPESAFE_OP_REF || "op://Development/Jev API Key/password";
const SHAPE = /^op:\/\/[^/]+\/[^/]+\/[^/]+/;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!SHAPE.test(REFERENCE)) {
  fail(`TYPESAFE_OP_REF is not a 1Password secret reference: ${REFERENCE}\nExpected op://<vault>/<item>/<field>.`);
}

let key;
try {
  // execFileSync, not a shell: the reference is an argument, never a command line.
  // `op read` writes only the value to stdout, and it is never logged or stored here.
  key = execFileSync("op", ["read", "--no-newline", REFERENCE], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
} catch (error) {
  const detail = String(error.stderr || error.message).trim();
  if (error.code === "ENOENT") {
    fail("The 1Password CLI (op) is not installed or not on PATH.\nInstall it from https://developer.1password.com/docs/cli/get-started/, or use `pnpm dev` with a key in .env.local.");
  }
  if (/not signed in|authoriz|session/i.test(detail)) {
    fail(`1Password is locked. Unlock the desktop app, or run: eval $(op signin)\n\n${detail}`);
  }
  if (/isn't an item|not found|no item|isn't a vault/i.test(detail)) {
    fail(`1Password has no item at ${REFERENCE}.\nSet TYPESAFE_OP_REF to the right reference.\n\n${detail}`);
  }
  fail(`Could not read the key from 1Password.\n\n${detail}`);
}

if (!key) fail(`${REFERENCE} resolved to an empty value.`);

const args = process.argv.slice(2);
const next = existsSync("node_modules/.bin/next") ? "node_modules/.bin/next" : "next";
console.log(`TypeSafe key read from ${REFERENCE}; it overrides any value in .env.local.`);

const child = spawn(next, args.length ? args : ["dev"], {
  stdio: "inherit",
  env: { ...process.env, TYPESAFE_API_KEY: key },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));
child.on("error", (error) => fail(`Could not start next: ${error.message}`));
