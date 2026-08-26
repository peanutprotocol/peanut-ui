#!/usr/bin/env node
// Prints the version to upload the OTA (Capgo) bundle under.
//
// Why: package.json's version is pinned and only moves on a native release, so
// every OTA upload after the first collided on the same bundle version. Capgo
// then either failed the job or (with --version-exists-ok) no-opped and shipped
// nothing. Deriving the version per commit makes each upload a real one, and
// keeps --version-exists-ok meaning "re-running the same commit is safe".
//
// Scheme: <major>.<minor> from package.json + the git commit count as patch,
// e.g. 1.0.9798. Two constraints drive it, both enforced below:
//   - unique per commit, or the upload silently does nothing;
//   - never sorting BELOW the native app version, or Capgo's
//     disable_auto_update_under_native rule makes devices reject the bundle.
//     That rules out a `1.0.8-<sha>` shape — a semver prerelease sorts under
//     plain 1.0.8, so every device on the 1.0.8 binary would refuse it.
// Anchoring major/minor to package.json keeps that floor correct when a native
// release bumps the app version — a release that overrides versionName without
// bumping package.json would strand OTA bundles under the shipped binary.
//
// Usage: node scripts/capgo-bundle-version.mjs
//   Needs full git history (actions/checkout with fetch-depth: 0) — a shallow
//   clone counts one commit, which is rejected here rather than shipped.
//
// Env knobs:
//   CAPGO_BUNDLE_VERSION  upload under this exact version instead of deriving one

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLAIN_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
    process.stdout.write(`${resolveBundleVersion()}\n`)
} catch (err) {
    console.error(`✗ cannot derive a Capgo bundle version: ${err.message}`)
    process.exit(1)
}

function resolveBundleVersion() {
    const nativeVersion = readPackageVersion()
    const override = process.env.CAPGO_BUNDLE_VERSION?.trim()
    if (override) {
        assertPlainSemver(override, 'CAPGO_BUNDLE_VERSION')
        assertAtLeastNative(override, nativeVersion)
        return override
    }
    return deriveVersion(nativeVersion, commitCount())
}

function deriveVersion(nativeVersion, count) {
    const [, major, minor, patch] = assertPlainSemver(nativeVersion, 'package.json version')
    if (count <= Number(patch)) {
        throw new Error(
            `commit count ${count} is not above the native patch ${patch} — a shallow ` +
                `clone? OTA workflows need actions/checkout with fetch-depth: 0.`
        )
    }
    return `${major}.${minor}.${count}`
}

function readPackageVersion() {
    return JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')).version
}

function commitCount() {
    const out = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
    if (!/^\d+$/.test(out)) throw new Error(`git rev-list returned "${out}"`)
    return Number(out)
}

function assertPlainSemver(version, label) {
    const match = PLAIN_SEMVER.exec(version ?? '')
    if (!match) throw new Error(`${label} must be a plain X.Y.Z semver, got "${version}"`)
    return match
}

// Capgo refuses on-device any bundle that sorts below the installed native
// version, so a lower override would upload fine and then reach nobody.
function assertAtLeastNative(version, nativeVersion) {
    const [, ...parts] = assertPlainSemver(version, 'CAPGO_BUNDLE_VERSION')
    const [, ...nativeParts] = assertPlainSemver(nativeVersion, 'package.json version')
    for (let i = 0; i < 3; i++) {
        if (Number(parts[i]) > Number(nativeParts[i])) return
        if (Number(parts[i]) < Number(nativeParts[i])) {
            throw new Error(`CAPGO_BUNDLE_VERSION ${version} is below the native version ${nativeVersion}`)
        }
    }
}
