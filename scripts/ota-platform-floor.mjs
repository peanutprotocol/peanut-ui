#!/usr/bin/env node

// Resolves, per platform, the OLDEST native release a bundle may be delivered to.
//
// Capgo carries one min_update_version per bundle record. Production OTA .1+
// uploads separate iOS/Android records so each server floor protects legacy
// clients before their first floor-aware OTA. The native .0 record is shared,
// so it uses the stricter (higher) of the two compatible platform floors.
//
// So the floor is computed here, per platform, from the surface rather than the
// number: walk the native releases newest-first and keep going while that
// platform's half of the fingerprint is unchanged. The last release that still
// matches is the floor — the oldest binary of that platform whose native
// contract is the one this tree was built against. The numbers are baked into
// the bundle (NEXT_PUBLIC_OTA_FLOOR_ANDROID / _IOS) and the on-device gate
// compares the running binary against the floor for its own platform.
//
// This only ever WIDENS delivery. The publish gate is unchanged: a tree whose
// surface differs from the newest release still fails check-native-ota-surface
// and still needs a coordinated native release.
//
// Usage:
//   node scripts/ota-platform-floor.mjs                 # both, as KEY=value lines
//   node scripts/ota-platform-floor.mjs --platform ios   # one, as a bare version
//   node scripts/ota-platform-floor.mjs --shared         # safe floor for one shared record
//   node scripts/ota-platform-floor.mjs --prospective-version 1.8.0
//   node scripts/ota-platform-floor.mjs --prospective-version 1.8.0 --replacement-platform android
//   node scripts/ota-platform-floor.mjs --ref <git-ref>

import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diff, platformDiff, setRepoRoot } from './native-fingerprint.mjs'
import { allNativeReleases, setRepoRoot as setVersionRepoRoot } from './release-version.mjs'

const require = createRequire(import.meta.url)
const { changesOutsidePlatform, changesUnsafeForSameVersion } = require('./check-native-change-scope.cjs')
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const PLATFORMS = ['android', 'ios']
const NATIVE_VERSION = /^(0|[1-9]\d*)\.([1-9]\d*)\.0$/

/**
 * The oldest native release of `platform` whose native surface still matches
 * `headRef`, as a plain `<major>.<build>.0` version.
 *
 * Contiguous from the newest on purpose. A release further back that happens to
 * match again — a native change made and then reverted — is not evidence that
 * the binaries in between can run this JS, and treating it as a floor would
 * hand a bundle to exactly the binaries the intervening change was made for.
 *
 * The scan also stops at the major boundary, even when the surface matches
 * across it. A major is a deliberate app-generation break: release-version.mjs
 * keeps a bundle's floor inside one major band, and the on-device comparison
 * checks majors before builds — so a floor of 1.6.0 published from a 2.x tree
 * would have every 1.6 binary accept a 2.x bundle, which is the one boundary
 * the scheme exists to hold.
 *
 * Throws when even the NEWEST release differs for this platform: there is no
 * binary in the field that carries this tree's contract, which is the state
 * check-native-ota-surface fails the publish on.
 */
function validateSameVersionReplacement({ platform, baseRef, headRef }) {
    const changes = diff(baseRef, headRef)
    const outside = changesOutsidePlatform(changes, platform)
    if (outside.length > 0) {
        throw new Error(
            `${baseRef} replacement contains non-${platform} native inputs:\n${outside
                .map(({ path }) => `  ${path}`)
                .join('\n')}`
        )
    }
    const unsafe = changesUnsafeForSameVersion(changes, platform)
    if (unsafe.length > 0) {
        throw new Error(
            `${baseRef} replacement is not safe for older same-version ${platform} installs:\n${unsafe
                .map(({ path }) => `  ${path}`)
                .join('\n')}`
        )
    }
}

export function platformFloor({
    platform,
    headRef = 'HEAD',
    root = defaultRoot,
    prospectiveVersion,
    replacementPlatform,
} = {}) {
    if (!PLATFORMS.includes(platform)) throw new Error(`platform must be android or ios, got "${platform}"`)
    if (replacementPlatform && !PLATFORMS.includes(replacementPlatform)) {
        throw new Error(`replacement platform must be android or ios, got "${replacementPlatform}"`)
    }
    if (replacementPlatform && !prospectiveVersion) {
        throw new Error('replacement platform requires --prospective-version')
    }
    setRepoRoot(root)
    setVersionRepoRoot(root)

    const releases = allNativeReleases()
    if (prospectiveVersion) {
        const match = NATIVE_VERSION.exec(prospectiveVersion)
        if (!match) throw new Error(`prospective version must be a native X.Y.0 version, got "${prospectiveVersion}"`)
        const prospective = { major: Number(match[1]), build: Number(match[2]) }
        const newer = releases.find(
            (release) =>
                release.major > prospective.major ||
                (release.major === prospective.major && release.build > prospective.build)
        )
        if (newer) {
            throw new Error(
                `prospective version ${prospectiveVersion} is older than native release ${newer.major}.${newer.build}.0`
            )
        }

        // The native workflow calls this before its success tag exists. Treat
        // the binary being built from headRef as the newest compatible shell,
        // then walk older attested releases exactly as the normal OTA path does.
        let floor = prospectiveVersion
        for (const { major, build } of releases) {
            if (major !== prospective.major || build > prospective.build) continue
            const tag = `v${major}.${build}.0`
            const changed = platformDiff(platform, tag, headRef)
            if (build === prospective.build) {
                if (changed.length > 0) {
                    if (replacementPlatform !== platform) {
                        throw new Error(
                            `${tag} already exists but its ${platform} native surface differs from ${headRef}`
                        )
                    }
                    // Older binaries share this versionName. Only the explicit,
                    // narrowly allowlisted replacement surface may differ.
                    validateSameVersionReplacement({ platform, baseRef: tag, headRef })
                }
                continue
            }
            if (changed.length > 0) break
            floor = `${major}.${build}.0`
        }
        return floor
    }

    if (releases.length === 0) throw new Error('no v<major>.<build>.0 tag exists in this repository')

    const currentMajor = releases[0].major
    let floor = null
    for (const { major, build } of releases) {
        if (major !== currentMajor) break
        const tag = `v${major}.${build}.0`
        if (platformDiff(platform, tag, headRef).length > 0) break
        floor = `${major}.${build}.0`
    }
    if (floor === null) {
        const newest = `v${releases[0].major}.${releases[0].build}.0`
        const changed = platformDiff(platform, newest, headRef)
            .map(({ path }) => `  ${path}`)
            .join('\n')
        throw new Error(
            `no shipped ${platform} binary carries this tree's native contract — it differs from ${newest}:\n${changed}\n` +
                'Cut a coordinated native release before publishing this OTA.'
        )
    }
    return floor
}

export function platformFloors({ headRef = 'HEAD', root = defaultRoot, prospectiveVersion, replacementPlatform } = {}) {
    return Object.fromEntries(
        PLATFORMS.map((platform) => [
            platform,
            platformFloor({ platform, headRef, root, prospectiveVersion, replacementPlatform }),
        ])
    )
}

export function sharedFloor(options = {}) {
    const floors = platformFloors(options)
    return PLATFORMS.map((platform) => floors[platform])
        .sort(compareVersions)
        .at(-1)
}

// Numeric on (major, build); the ota segment of a floor is always 0.
function compareVersions(a, b) {
    const [aMajor, aBuild] = a.split('.').map(Number)
    const [bMajor, bBuild] = b.split('.').map(Number)
    return aMajor - bMajor || aBuild - bBuild
}

function flag(argv, name) {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    try {
        const argv = process.argv.slice(2)
        const root = flag(argv, '--root') ?? defaultRoot
        const headRef = flag(argv, '--ref') ?? 'HEAD'
        const platform = flag(argv, '--platform')
        const prospectiveVersion = flag(argv, '--prospective-version')
        const replacementPlatform = flag(argv, '--replacement-platform')
        for (const name of ['--root', '--ref', '--platform', '--prospective-version', '--replacement-platform']) {
            if (argv.includes(name) && !flag(argv, name)) throw new Error(`${name} needs a value`)
        }
        if (platform && argv.includes('--shared')) throw new Error('--platform and --shared are mutually exclusive')
        const options = { headRef, root, prospectiveVersion, replacementPlatform }
        if (argv.includes('--lowest')) {
            // Diagnostic only. Never use this value as a shared server floor:
            // legacy updaters cannot enforce the stricter platform requirement.
            const floors = platformFloors(options)
            const lowest = PLATFORMS.map((name) => floors[name]).sort(compareVersions)[0]
            process.stdout.write(`${lowest}\n`)
        } else if (argv.includes('--shared')) {
            process.stdout.write(`${sharedFloor(options)}\n`)
        } else if (platform) {
            process.stdout.write(`${platformFloor({ platform, ...options })}\n`)
        } else {
            const floors = platformFloors(options)
            process.stdout.write(
                `NEXT_PUBLIC_OTA_FLOOR_ANDROID=${floors.android}\nNEXT_PUBLIC_OTA_FLOOR_IOS=${floors.ios}\n`
            )
        }
    } catch (err) {
        console.error(`✗ ota-platform-floor: ${err.message}`)
        process.exit(1)
    }
}
