#!/usr/bin/env node
// Prints "true" when <candidate> sorts strictly above <baseline> in semver
// order, "false" otherwise. Exits 1 on unusable input so a caller under
// `set -e` dies instead of misreading an error as "false".
//
// Usage: node scripts/semver-newer.mjs <candidate> <baseline>
//
// Why prerelease-aware ordering matters here: Capgo compares a device's native
// version against bundle versions with full semver semantics, and its
// disable_auto_update_under_native rule rejects any bundle sorting below the
// binary. 1.0.54-hotfix1 sorts BELOW 1.0.54 — `sort -V` gets exactly that case
// backwards, which is the difference between "fleet is covered" and every
// device silently refusing updates (TASK-21793).

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

const [candidate, baseline] = process.argv.slice(2)

try {
    process.stdout.write(`${compare(parse(candidate, 'candidate'), parse(baseline, 'baseline')) > 0}\n`)
} catch (err) {
    console.error(`✗ semver-newer: ${err.message}`)
    process.exit(1)
}

function parse(version, label) {
    const match = SEMVER.exec(version ?? '')
    if (!match) throw new Error(`${label} must be X.Y.Z or X.Y.Z-<prerelease>, got "${version}"`)
    const [, major, minor, patch, prerelease] = match
    return { numbers: [Number(major), Number(minor), Number(patch)], prerelease: prerelease?.split('.') }
}

function compare(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] - b.numbers[i]
    }
    if (!a.prerelease && !b.prerelease) return 0
    if (!a.prerelease) return 1
    if (!b.prerelease) return -1
    const len = Math.max(a.prerelease.length, b.prerelease.length)
    for (let i = 0; i < len; i++) {
        const [x, y] = [a.prerelease[i], b.prerelease[i]]
        if (x === undefined) return -1
        if (y === undefined) return 1
        const [xNum, yNum] = [/^\d+$/.test(x), /^\d+$/.test(y)]
        if (xNum && yNum) {
            if (Number(x) !== Number(y)) return Number(x) - Number(y)
        } else if (xNum !== yNum) {
            return xNum ? -1 : 1
        } else if (x !== y) {
            return x < y ? -1 : 1
        }
    }
    return 0
}
