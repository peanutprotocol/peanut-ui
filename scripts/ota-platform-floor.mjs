#!/usr/bin/env node

// Resolves, per platform, the OLDEST native release a bundle may be delivered to.
//
// Capgo carries one min_update_version per bundle record. Production uploads
// separate iOS/Android records so each server floor protects legacy clients
// before their first floor-aware OTA. A lower shared floor is unsafe.
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
//   node scripts/ota-platform-floor.mjs --ref <git-ref>

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platformDiff, setRepoRoot } from './native-fingerprint.mjs'
import { allNativeReleases, setRepoRoot as setVersionRepoRoot } from './release-version.mjs'

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const PLATFORMS = ['android', 'ios']

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
export function platformFloor({ platform, headRef = 'HEAD', root = defaultRoot }) {
    if (!PLATFORMS.includes(platform)) throw new Error(`platform must be android or ios, got "${platform}"`)
    setRepoRoot(root)
    setVersionRepoRoot(root)

    const releases = allNativeReleases()
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

export function platformFloors({ headRef = 'HEAD', root = defaultRoot } = {}) {
    return Object.fromEntries(PLATFORMS.map((platform) => [platform, platformFloor({ platform, headRef, root })]))
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
        for (const name of ['--root', '--ref', '--platform']) {
            if (argv.includes(name) && !flag(argv, name)) throw new Error(`${name} needs a value`)
        }
        if (argv.includes('--lowest')) {
            // Diagnostic only. Never use this value as a shared server floor:
            // legacy updaters cannot enforce the stricter platform requirement.
            const floors = platformFloors({ headRef, root })
            const lowest = PLATFORMS.map((name) => floors[name]).sort(compareVersions)[0]
            process.stdout.write(`${lowest}\n`)
        } else if (platform) {
            process.stdout.write(`${platformFloor({ platform, headRef, root })}\n`)
        } else {
            const floors = platformFloors({ headRef, root })
            process.stdout.write(
                `NEXT_PUBLIC_OTA_FLOOR_ANDROID=${floors.android}\nNEXT_PUBLIC_OTA_FLOOR_IOS=${floors.ios}\n`
            )
        }
    } catch (err) {
        console.error(`✗ ota-platform-floor: ${err.message}`)
        process.exit(1)
    }
}
