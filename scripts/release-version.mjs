#!/usr/bin/env node
// Resolves every version number the release pipeline ships, so nobody types one.
//
// Scheme: <major>.<build>.<ota>
//   major   app generation. Only moves on a deliberate major upgrade; read from
//           package.json so there is one place to change it.
//   build   native build counter. Every store build bumps it and resets ota to 0.
//   ota     OTA counter within one native build. 0 is the JS baked into the
//           binary; each subsequent OTA adds 1.
//
// Two properties fall out of the shape, and both used to be hand-maintained:
// every OTA sorts strictly above the binary it targets (Capgo's
// disable_auto_update_under_native drops anything below it — TASK-21793 killed
// OTA for 102 devices for a month that way), and the version alone says which
// binary a bundle belongs to.
//
// The registry is git tags (`v<major>.<build>.0`) plus the Capgo channel, never a
// file in the repo: `dev` and `main` both carry a pull_request ruleset with no
// bypass actors, so CI cannot push a version-bump commit and package.json cannot
// be the auto-bumped source of truth. Only its major is load-bearing here.
//
// Usage:
//   node scripts/release-version.mjs native
//   node scripts/release-version.mjs ota --current <version>
//   node scripts/release-version.mjs staging
//   node scripts/release-version.mjs native-floor
//   node scripts/release-version.mjs validate <version> --kind <native|ota>
//
// Needs full history and tags (actions/checkout with fetch-depth: 0).

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLAIN_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const CHANNEL_SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
    process.stdout.write(`${main(process.argv.slice(2))}\n`)
} catch (err) {
    console.error(`✗ release-version: ${err.message}`)
    process.exit(1)
}

function main(argv) {
    const [mode, ...rest] = argv
    const major = readMajor()

    switch (mode) {
        case 'native':
            return `${major}.${latestBuild(major) + 1}.0`
        case 'ota':
            return nextOta(major, flag(rest, '--current'))
        case 'staging':
            return `${major}.${latestBuild(major)}.${commitCount()}`
        case 'native-floor':
            return nativeFloor(major)
        case 'validate':
            return validate(major, rest[0], flag(rest, '--kind'))
        default:
            throw new Error(`unknown mode "${mode ?? ''}" — expected native, ota, staging, native-floor or validate`)
    }
}

// The production OTA lane hangs off the newest native build, not off whatever the
// channel happens to serve: a channel left behind by a fresh binary must jump to
// that binary's build number rather than keep counting under the old one.
function nextOta(major, current) {
    const build = latestBuild(major)
    if (build === 0) throw new Error(`no v${major}.<build>.0 tag exists yet — cut a native release before an OTA`)

    const match = CHANNEL_SEMVER.exec(current ?? '')
    if (!match) throw new Error(`--current must be X.Y.Z or X.Y.Z-<prerelease>, got "${current}"`)
    const [, currentMajor, currentBuild, currentOta] = match.map(Number)

    if (currentMajor !== major || currentBuild > build) {
        throw new Error(
            `channel serves ${current}, which is ahead of the newest native build ${major}.${build}.0 — ` +
                `refusing to guess a version that devices would refuse`
        )
    }
    return currentBuild === build ? `${major}.${build}.${currentOta + 1}` : `${major}.${build}.1`
}

// Staging deliberately keeps the commit count as its ota component. It shares one
// bundle namespace with production, and production counts OTAs in single digits,
// so the ~10k commit count is what keeps the two lanes from colliding on a version
// (a collision no-ops under --version-exists-ok and ships nothing). It still rides
// the current build number, or it would sort below the binary the moment one ships.
function commitCount() {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: repoRoot,
        encoding: 'utf8',
    }).trim()
    if (shallow === 'true') throw new Error('shallow clone — OTA workflows need fetch-depth: 0.')
    const out = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
    if (!/^\d+$/.test(out)) throw new Error(`git rev-list returned "${out}"`)
    return Number(out)
}

// The newest native release, for a bundle's --min-update-version. A bundle
// built from the current tree targets the newest shell, and Capgo's
// --auto-min-update-version only copies the previous bundle's floor forward,
// so on a checkout with no native version stamped on disk the floor never rose.
function nativeFloor(major) {
    const build = latestBuild(major)
    if (build === 0)
        throw new Error(`no v${major}.<build>.0 tag exists — cut a native release before publishing a bundle`)
    return `${major}.${build}.0`
}

function validate(major, version, kind) {
    const match = PLAIN_SEMVER.exec(version ?? '')
    if (!match) throw new Error(`"${version}" is not a plain X.Y.Z version`)
    const [, versionMajor, build, ota] = match.map(Number)

    if (versionMajor !== major) {
        throw new Error(`"${version}" is major ${versionMajor}, but this app is major ${major}`)
    }
    if (build < 1) throw new Error(`"${version}" has build 0 — build numbers start at 1`)
    if (kind === 'native' && ota !== 0) {
        throw new Error(`"${version}" is a native release, which must end in .0 (an OTA version cannot ship a binary)`)
    }
    if (kind === 'ota' && ota === 0) {
        throw new Error(`"${version}" ends in .0, which is the JS baked into a binary — an OTA must be .1 or above`)
    }
    if (kind !== 'native' && kind !== 'ota') throw new Error(`--kind must be native or ota, got "${kind ?? ''}"`)
    return version
}

function readMajor() {
    const { version } = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
    const match = PLAIN_SEMVER.exec(version ?? '')
    if (!match) throw new Error(`package.json version must be a plain X.Y.Z, got "${version}"`)
    return Number(match[1])
}

// Returns 0 when no native release exists for this major, so the first one is .1.
function latestBuild(major) {
    const tags = execFileSync('git', ['tag', '--list', 'v*'], { cwd: repoRoot, encoding: 'utf8' }).split('\n')
    if (!tags.some((tag) => tag.trim())) {
        throw new Error('no v* tags are visible — the resolver needs actions/checkout with fetch-depth: 0')
    }
    const pattern = new RegExp(`^v${major}\\.(\\d+)\\.0$`)
    return tags.reduce((highest, tag) => {
        const match = pattern.exec(tag.trim())
        return match ? Math.max(highest, Number(match[1])) : highest
    }, 0)
}

function flag(argv, name) {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
}
