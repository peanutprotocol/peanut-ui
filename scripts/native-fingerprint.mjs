#!/usr/bin/env node
// Hashes the JS<->native contract, so an OTA can tell whether the bundle it is
// about to publish still fits the binaries that will receive it.
//
// The problem this closes: JS and native ship on two independent clocks, and a
// bundle's only identity is a version number, which says nothing about the
// native surface it needs. `1.2.1` does not encode "requires the 8.51 updater
// plugin", so CI will happily publish a bundle built against new plugins onto
// binaries built months earlier, and the mismatch first appears on a user's
// device. Capgo's own `min_update_version` only blocks *delivery*, only under
// the `metadata` channel strategy, and lives in a dashboard CI cannot see — it
// never tells you that you built an incompatible bundle.
//
// The fingerprint is a pure function of the repo tree, so it needs no storage:
// a native release's surface is exactly what its tagged commit describes. The
// OTA lane compares the tree it is publishing against the newest
// `v<major>.<build>.0` tag and refuses when they disagree, naming the file that
// moved. That is the rule docs/NATIVE-RELEASE.md already states ("bump the
// native version whenever you change plugins/native code") with something
// actually checking it.
//
// Scope is deliberately the *contract*, not every native file. Capacitor's two
// generated manifests pin the plugin set AND their exact versions in the
// dependency paths (`@capgo+capacitor-updater@8.51.14`), which is where the
// JS<->native coupling really lives; the rest are the native config surfaces a
// bundle can observe at runtime. Generated web assets (ios/App/App/public,
// android/app/src/main/assets/public) are excluded on purpose — they are OTA
// output, and including them would change the fingerprint on every commit.
//
// Usage:
//   node scripts/native-fingerprint.mjs                 # hash of the working tree
//   node scripts/native-fingerprint.mjs --ref v1.2.0    # hash at a git ref
//   node scripts/native-fingerprint.mjs --manifest      # per-input hashes as JSON
//   node scripts/native-fingerprint.mjs --diff v1.2.0   # what moved; exit 1 if anything did

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Every input is one line of the manifest. Adding one is a deliberate act: it
// widens what counts as "the native surface changed" and therefore how often an
// OTA is refused, so prefer the narrowest file that actually carries the
// contract over the directory that contains it.
export const NATIVE_INPUTS = [
    // Capacitor's generated plugin manifests — the plugin set and their exact
    // resolved versions, for each platform. These are what actually move when a
    // plugin is added, removed or bumped.
    'android/capacitor.settings.gradle',
    'ios/App/CapApp-SPM/Package.swift',

    // Native runtime config the JS half reads through the bridge.
    'capacitor.config.ts',

    // Android build surface: dependencies, SDK levels, permissions.
    'android/build.gradle',
    'android/app/build.gradle',
    'android/variables.gradle',
    'android/app/src/main/AndroidManifest.xml',

    // iOS build surface: targets, deployment floor, capabilities.
    'ios/App/App.xcodeproj/project.pbxproj',
    'ios/App/App/Info.plist',
    'ios/App/App/App.entitlements',
    'ios/App/App/AppRelease.entitlements',
]

// A file the tree does not have is still a fact about the surface — adding or
// deleting one must move the fingerprint — so absence gets its own sentinel
// rather than being skipped.
const ABSENT = '<absent>'

/*
 * project.pbxproj carries MARKETING_VERSION, which scripts/native-ios-postsync.js
 * stamps from the release version on every `cap sync`. That is the release
 * number, not the native surface: left raw it would change the fingerprint on
 * every single release and make the check cry wolf forever. CURRENT_PROJECT_VERSION
 * is the CI run number and is normalised for the same reason.
 */
function normalize(path, content) {
    if (!path.endsWith('project.pbxproj')) return content
    return content
        .replace(/MARKETING_VERSION = [^;]*;/g, 'MARKETING_VERSION = <normalized>;')
        .replace(/CURRENT_PROJECT_VERSION = [^;]*;/g, 'CURRENT_PROJECT_VERSION = <normalized>;')
}

function readAtRef(path, ref) {
    if (!ref) {
        try {
            return readFileSync(resolve(repoRoot, path), 'utf8')
        } catch (err) {
            if (err.code === 'ENOENT') return null
            throw err
        }
    }
    try {
        // `git show` writes to stderr and exits non-zero for a missing path,
        // which is how absence is detected at a ref.
        return execFileSync('git', ['show', `${ref}:${path}`], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            maxBuffer: 64 * 1024 * 1024,
        })
    } catch {
        return null
    }
}

function sha(text) {
    return createHash('sha256').update(text).digest('hex')
}

export function manifest(ref) {
    const entries = {}
    for (const path of NATIVE_INPUTS) {
        const raw = readAtRef(path, ref)
        entries[path] = raw === null ? ABSENT : sha(normalize(path, raw))
    }
    return entries
}

// Hash of the manifest, not of the concatenated files: the per-input digests
// are what a diff reports, so the summary hash must be derived from exactly
// what the diff inspects or the two could disagree.
export function fingerprint(ref) {
    const entries = manifest(ref)
    const canonical = NATIVE_INPUTS.map((path) => `${path}:${entries[path]}`).join('\n')
    return sha(canonical).slice(0, 16)
}

export function diff(baseRef, headRef) {
    const base = manifest(baseRef)
    const head = manifest(headRef)
    return NATIVE_INPUTS.filter((path) => base[path] !== head[path]).map((path) => ({
        path,
        base: base[path],
        head: head[path],
    }))
}

function flag(argv, name) {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
}

function main(argv) {
    const ref = flag(argv, '--ref')

    if (argv.includes('--manifest')) {
        return JSON.stringify(manifest(ref), null, 2)
    }

    // Presence of the flag decides the mode, never the value it picked up: a
    // trailing `--diff` reads as "compare against nothing", and silently
    // printing a fingerprint instead would let a misconfigured workflow step
    // pass while checking nothing at all.
    if (argv.includes('--diff')) {
        const against = flag(argv, '--diff')
        if (!against) throw new Error('--diff needs a git ref to compare against')
        const changed = diff(against, ref)
        if (changed.length === 0) {
            return `native surface unchanged since ${against} (${fingerprint(against)})`
        }
        const lines = changed.map(({ path, base, head }) => {
            const describe = (value) => (value === ABSENT ? 'absent' : value.slice(0, 12))
            return `  ${path}: ${describe(base)} -> ${describe(head)}`
        })
        process.stdout.write(
            `native surface changed since ${against}: ${fingerprint(against)} -> ${fingerprint(ref)}\n` +
                `${lines.join('\n')}\n`
        )
        process.exit(1)
    }

    return fingerprint(ref)
}

// Only run as a CLI; the exports above are what the tests use.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    try {
        process.stdout.write(`${main(process.argv.slice(2))}\n`)
    } catch (err) {
        console.error(`✗ native-fingerprint: ${err.message}`)
        process.exit(1)
    }
}
