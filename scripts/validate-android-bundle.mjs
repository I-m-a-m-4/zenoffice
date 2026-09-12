#!/usr/bin/env node
/**
 * validate-android-bundle.mjs
 * ----------------------------
 * Runs BEFORE uploading to Play Store to catch common errors locally.
 *
 * Checks:
 *  1. versionCode in tauri.conf.json > LAST_KNOWN_PLAY_VERSION_CODE
 *  2. The .aab file actually exists and is non-zero
 *  3. (optional) bundletool validate if Java + bundletool are available
 *
 * Usage:
 *   node scripts/validate-android-bundle.mjs [path/to/app.aab]
 */

import { readFileSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

/**
 * The highest versionCode currently live on Play Store.
 * UPDATE THIS every time a release goes live (grep for "BUMP_AFTER_RELEASE").
 */
const LAST_KNOWN_PLAY_VERSION_CODE = 3002007; // BUMP_AFTER_RELEASE

// Default AAB path produced by `npm run tauri android build`
const DEFAULT_AAB = resolve(
  ROOT,
  "src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab"
);

// bundletool JAR location (downloaded once, stays in Downloads)
const BUNDLETOOL_JAR = "C:\\Users\\Bello Imam\\Downloads\\bundletool-all.jar";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function pass(msg) { console.log(green("  ✔ ") + msg); passed++; }
function fail(msg) { console.log(red("  ✘ ") + bold(msg)); failed++; }
function warn(msg) { console.log(yellow("  ⚠ ") + msg); }
function header(msg) { console.log(`\n${bold(msg)}`); }

// ─── CHECKS ──────────────────────────────────────────────────────────────────

header("① Checking tauri.conf.json versionCode...");

const conf = JSON.parse(readFileSync(resolve(ROOT, "src-tauri/tauri.conf.json"), "utf8"));
const appVersion   = conf.version;
const versionCode  = conf.bundle?.android?.versionCode;

if (versionCode == null) {
  fail("bundle.android.versionCode is missing from tauri.conf.json");
} else {
  console.log(`   app version   : ${appVersion}`);
  console.log(`   versionCode   : ${versionCode}`);
  console.log(`   play store min: ${LAST_KNOWN_PLAY_VERSION_CODE + 1}`);

  if (versionCode <= LAST_KNOWN_PLAY_VERSION_CODE) {
    fail(
      `versionCode ${versionCode} <= live versionCode ${LAST_KNOWN_PLAY_VERSION_CODE}. ` +
      `Existing users CANNOT upgrade. Set it to at least ${LAST_KNOWN_PLAY_VERSION_CODE + 1}.`
    );
  } else {
    pass(`versionCode ${versionCode} is higher than live (${LAST_KNOWN_PLAY_VERSION_CODE})`);
  }
}

// ─── AAB FILE CHECK ──────────────────────────────────────────────────────────

header("② Checking AAB file...");

const aabPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_AAB;
console.log(`   path: ${aabPath}`);

if (!existsSync(aabPath)) {
  fail(`AAB not found at:\n     ${aabPath}\n     Run: npm run tauri android build`);
} else {
  const sizeBytes = statSync(aabPath).size;
  const sizeMB    = (sizeBytes / 1024 / 1024).toFixed(1);
  if (sizeBytes === 0) {
    fail("AAB file is 0 bytes - build likely failed.");
  } else {
    pass(`AAB exists (${sizeMB} MB)`);
  }
}

// ─── BUNDLETOOL VALIDATE ─────────────────────────────────────────────────────

header("③ Running bundletool validate...");

const hasJava = (() => {
  try { execSync("java -version", { stdio: "pipe" }); return true; }
  catch { return false; }
})();

const hasBundletool = existsSync(BUNDLETOOL_JAR);

if (!hasJava) {
  warn("Java not found - skipping bundletool check. Install JDK to enable.");
} else if (!hasBundletool) {
  warn(`bundletool JAR not found at ${BUNDLETOOL_JAR}. Download from:`);
  warn("https://github.com/google/bundletool/releases/latest");
} else if (existsSync(aabPath) && statSync(aabPath).size > 0) {
  try {
    execSync(
      `java -jar "${BUNDLETOOL_JAR}" validate --bundle="${aabPath}"`,
      { stdio: "pipe" }
    );
    pass("bundletool validate passed");
  } catch (e) {
    fail("bundletool validate FAILED:\n" + e.stderr?.toString()?.trim());
  }
} else {
  warn("Skipping bundletool (AAB not found).");
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log("\n" + "-".repeat(50));
if (failed === 0) {
  console.log(green(bold(`\n  All ${passed} checks passed - safe to upload!\n`)));
  process.exit(0);
} else {
  console.log(red(bold(`\n  ${failed} check(s) FAILED - DO NOT upload yet.\n`)));
  process.exit(1);
}
