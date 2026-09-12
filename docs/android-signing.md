# Android Release Signing

How Zeneva's Android releases get signed, and how to fix the
"signed with the wrong key" rejection if it comes back.

Stack context for the Android target is in [`technology.md`](technology.md) §2
and §5; this file is the signing detail.

## The two keys

Play App Signing means there are two separate keys. Confusing them is the
root of most signing trouble.

| | Upload key | App signing key |
|---|---|---|
| Held by | us, in `ANDROID_KEYSTORE_BASE64` | Google |
| Used for | signing the AAB we upload | signing what users install |
| If lost | request a reset, keep publishing | unrecoverable |

Play checks the AAB against the **upload key** on upload, strips that
signature, and re-signs with the **app signing key**. So a wrong upload key
blocks the upload but never affects installed apps.

## Current values

The registered upload key, alias `zeneva`:

```
SHA1:   65:A6:D6:7D:31:85:86:53:10:7C:ED:1F:97:4F:0A:C4:F9:0D:AE:FF
SHA256: 5C:20:BF:52:BD:9A:C3:0A:5A:A3:C4:AF:D2:7A:C6:EA:14:23:7B:B0:CE:37:8A:BF:FE:E2:BC:AC:19:63:8F:D1
```

The SHA-256 is also in `public/.well-known/assetlinks.json` for App Links.
**If the key is ever rotated, that file has to change too** or Android App
Links silently stop verifying.

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | keystore, base64, single line no wrapping |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_PASSWORD` | key password |
| `ANDROID_KEY_ALIAS` | `zeneva` |

## What went wrong in 3.1.2, and why

Uploads were rejected with:

```
expected: SHA1 65:A6:D6:7D:...   (registered upload key)
got:      SHA1 93:A7:75:21:...   (a different keystore)
```

Two causes, compounding:

1. **`generate-keystore.yml` created a brand-new keystore on each run and
   committed it to the repo.** Every run replaced the key that Play had
   registered. This is the origin of the problem and the workflow is now
   disabled.
2. **Alias mismatch.** `key.properties` used `keyAlias=upload`, but the
   registered key's alias is `zeneva`. Gradle signed with whatever the
   secrets pointed at, which was not the registered key.

The key was never actually lost — it was in git history the whole time
(commit `210ce8f`, blob `faedf5a`). Roughly two days went into chasing a
Play Console upload key reset that was never needed. **Read the fingerprint
before assuming a key is gone.**

## Debugging a fingerprint rejection

Work in this order. Do not skip to step 4.

**1. Read what Play is asking for.** The error gives both fingerprints —
expected and actual. That is the whole diagnosis in two lines.

**2. Check the alias first.** Cheapest fix, and it was the real cause last
time. `ANDROID_KEY_ALIAS` must match the alias inside the keystore, not
whatever `key.properties` says locally.

```powershell
keytool -list -v -keystore <file> -storepass <pw>
```

**3. Search git history before concluding the key is lost.**

```bash
git log --all --diff-filter=A --name-only -- '*.keystore' '*.jks'
git rev-list --objects --all | grep -i keystore
```

Extract a blob with `cmd /c` on Windows, never PowerShell `>` — PowerShell
adds a BOM and mangles binary, producing a corrupt keystore that fails to
open for reasons unrelated to the key:

```powershell
cmd /c "git cat-file -p <blob> > `"%USERPROFILE%\Documents\recovered.keystore`""
```

**4. Only if the key is genuinely gone or exposed**, request an upload key
reset. Play Console → app → **Test and release → App integrity →
App signing** tab → *Request upload key reset*. It is not under a "Setup"
section; that no longer exists. Requires the account owner, or an account
with `Manage app signing` granted for that specific app under the **Apps**
tab of Users and permissions. Turnaround is 1–2 business days.

Export the certificate to attach:

```powershell
keytool -export -rfc -keystore <file> -alias <alias> -file upload_certificate.pem
```

Send the `.pem` only. Never the `.jks`/`.keystore` — that holds the private
key. The Play Licensing key under Monetize is unrelated; not this.

## The CI verification gate

`release.yml` reads the built AAB's real certificate and compares it to the
`EXPECTED` fingerprint in the *Verify AAB signing certificate* step before
publishing. Wrong key, unsigned, or missing AAB all fail the job. This
exists so a fingerprint mismatch surfaces in CI in a few minutes rather than
at Play upload after a full release cycle.

When rotating keys, update `EXPECTED` in `release.yml` **and** the hash in
`assetlinks.json`. Leaving the old value fails every build.

## Releasing

Version comes from `package.json`, not from the git tag — `release.yml`
publishes to `v${APP_VERSION}`. Tagging `v3.1.3` while `package.json` says
`3.1.2` uploads artifacts to the `v3.1.2` release. Bump all three together:
`package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`.

```bash
git push origin main
git tag -a v3.1.3 -m "..." && git push origin v3.1.3
```

`src-tauri/gen/android/tauri.properties` is untracked and regenerated in CI
from `tauri.conf.json`. A local stale `versionCode` there is harmless, but
Play rejects any `versionCode` not strictly higher than the last upload, so
check it on the first successful upload after a gap.

## Rules

- **Workflow env, not step env.** `tauri.conf.json`'s `beforeBuildCommand`
  runs `scripts/tauri-prebuild.mjs`, which calls `npm run build` a *second*
  time inside the `tauri-action` step. That rebuild is what gets bundled.
  Secrets declared only on the "Build frontend" step do not reach it, so the
  `NEXT_PUBLIC_*` values inline as `undefined`, Firebase initialises with an
  empty config, and every login fails with "Invalid email or password" —
  the credentials are fine, the app simply has no backend. This shipped in
  3.1.2. `NEXT_PUBLIC_*` now lives in the workflow-level `env:` block so
  every step and every nested process inherits it, and a *Verify Firebase
  config is present* step fails the build if any is missing.
- **Never generate a signing key in CI.** Generate once, locally, store as a
  secret. A workflow that mints keys will eventually mint one Play doesn't
  know about, which is exactly what happened here.
- **Never commit a keystore or its password.** `zeneva.keystore` is in this
  repo's history with `zenevapass` in a committed workflow. The repo is
  toggled public to run Actions, so treat that key as exposed — flipping back
  to private does not un-publish what was already fetched. Rotating it means
  a real upload key reset plus updating `EXPECTED` in `release.yml` and the
  hash in `assetlinks.json`.
- **Keep the keystore backed up off-machine.** Losing it costs 1–2 days.
- **Pass secrets via `env:`, not inline `${{ }}` in shell.** Inline
  interpolation breaks on base64 `+` and `/` and can leak values into logs.
