#!/usr/bin/env node

// Verifies that an OTA still fits the native binary named by its floor. A
// successful same-version platform replacement can record an annotated
// baseline tag after the store upload; later OTAs may compare against that
// baseline only when its delta from the original native tag is narrowly
// legacy-compatible. This keeps both populations safe: the replacement shell
// gets the repaired native packaging, while older binaries with the same
// versionName continue receiving bundles that require no new native contract.

import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkLegacyAndroidPermissions } from './check-legacy-android-permissions.mjs'
import { diff, fingerprint, legacyV2Fingerprint, setRepoRoot } from './native-fingerprint.mjs'

const require = createRequire(import.meta.url)
const { changesOutsidePlatform, changesUnsafeForSameVersion } = require('./check-native-change-scope.cjs')
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ATTESTATION =
    /^peanut-native-replacement-v(2|3): platform=(android|ios) base=(v\d+\.\d+\.\d+) native-compatible=true js-guard=(android-capacitor-permissions-v1) fingerprint=([0-9a-f]{16})$/

function git(root, args) {
    return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
}

function isAncestor(root, older, newer) {
    return spawnSync('git', ['merge-base', '--is-ancestor', older, newer], { cwd: root }).status === 0
}

function changedPaths(changes) {
    return changes.map(({ path }) => path)
}

function failChanged(baseRef, headRef, changes) {
    throw new Error(
        `this tree's native surface differs from ${baseRef}${headRef === 'HEAD' ? '' : ` at ${headRef}`}:\n` +
            `${changedPaths(changes)
                .map((path) => `  ${path}`)
                .join('\n')}\n` +
            'Cut a coordinated native release before publishing this OTA.'
    )
}

function parseAttestation(root, tag) {
    if (git(root, ['cat-file', '-t', tag]) !== 'tag') {
        throw new Error(`${tag} is lightweight; replacement baselines must be annotated attestations`)
    }
    const contents = git(root, ['for-each-ref', '--format=%(contents)', `refs/tags/${tag}`])
    const line = contents.split('\n').find((candidate) => candidate.startsWith('peanut-native-replacement-v'))
    const match = ATTESTATION.exec(line ?? '')
    if (!match) throw new Error(`${tag} is missing a valid peanut-native-replacement-v2 or v3 attestation`)
    return {
        schema: Number(match[1]),
        platform: match[2],
        baseRef: match[3],
        jsGuard: match[4],
        fingerprint: match[5],
    }
}

function validateCandidate(root, tag, baseRef, platform) {
    const attestation = parseAttestation(root, tag)
    if (attestation.platform !== platform || attestation.baseRef !== baseRef) {
        throw new Error(
            `${tag} attests ${attestation.platform} from ${attestation.baseRef}, expected ${platform} from ${baseRef}`
        )
    }

    const changes = diff(baseRef, tag)
    if (changes.length === 0) throw new Error(`${tag} records no native replacement change`)
    const outside = changesOutsidePlatform(changes, platform)
    if (outside.length > 0) {
        throw new Error(
            `${tag} includes non-${platform} native inputs:\n${changedPaths(outside)
                .map((path) => `  ${path}`)
                .join('\n')}`
        )
    }
    const unsafe = changesUnsafeForSameVersion(changes, platform)
    if (unsafe.length > 0) {
        throw new Error(
            `${tag} changes native inputs that older same-version ${platform} installs do not have:\n` +
                changedPaths(unsafe)
                    .map((path) => `  ${path}`)
                    .join('\n')
        )
    }
    const actual = attestation.schema === 2 ? legacyV2Fingerprint(tag) : fingerprint(tag)
    if (attestation.fingerprint !== actual) {
        throw new Error(`${tag} attests fingerprint ${attestation.fingerprint}, but its commit is ${actual}`)
    }
    return git(root, ['rev-list', '--count', `${baseRef}..${tag}`])
}

export function replacementBaseline({ root = defaultRoot, baseRef, platform = 'android', headRef = 'HEAD' }) {
    if (!/^v\d+\.\d+\.\d+$/.test(baseRef ?? '')) throw new Error('base ref must be vX.Y.Z')
    if (!['android', 'ios'].includes(platform)) throw new Error('platform must be android or ios')
    setRepoRoot(root)

    // A baseline from another branch or a future commit must never influence
    // this checkout. Matching ancestor tags are all validated; a malformed one
    // fails closed rather than being silently skipped.
    if (!isAncestor(root, baseRef, headRef)) throw new Error(`${baseRef} is not an ancestor of ${headRef}`)
    const pattern = `${platform}-${baseRef}-replacement-*`
    const candidates = git(root, ['tag', '--list', pattern])
        .split('\n')
        .filter(Boolean)
        .filter((tag) => isAncestor(root, tag, headRef))
        .map((tag) => ({ tag, distance: Number(validateCandidate(root, tag, baseRef, platform)) }))
        .sort((a, b) => b.distance - a.distance || b.tag.localeCompare(a.tag))

    return candidates[0]?.tag ?? baseRef
}

export function checkNativeOtaSurface({ root = defaultRoot, baseRef, platform = 'android', headRef = 'HEAD' }) {
    const baseline = replacementBaseline({ root, baseRef, platform, headRef })

    if (baseline === baseRef) {
        const changes = diff(baseRef, headRef)
        if (changes.length > 0) failChanged(baseRef, headRef, changes)
        return `native surface matches original ${baseRef} (${fingerprint(baseRef)})`
    }

    const changes = diff(baseline, headRef)
    if (changes.length > 0) failChanged(baseline, headRef, changes)
    if (platform === 'android') checkLegacyAndroidPermissions({ root, ref: headRef })
    return `native surface matches attested ${platform} replacement ${baseline} (${fingerprint(
        baseline
    )}); older ${baseRef} installs remain on the guarded legacy contract`
}

function flag(argv, name) {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    try {
        const argv = process.argv.slice(2)
        const [baseRef] = argv
        const root = flag(argv, '--root') ?? defaultRoot
        const platform = flag(argv, '--platform') ?? 'android'
        const headRef = flag(argv, '--ref') ?? 'HEAD'
        if (argv.includes('--root') && !flag(argv, '--root')) throw new Error('--root needs a directory')
        if (argv.includes('--ref') && !flag(argv, '--ref')) throw new Error('--ref needs a git ref')
        process.stdout.write(`${checkNativeOtaSurface({ root, baseRef, platform, headRef })}\n`)
    } catch (err) {
        console.error(`✗ native-ota-surface: ${err.message}`)
        process.exit(1)
    }
}
