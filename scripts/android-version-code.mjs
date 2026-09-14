#!/usr/bin/env node
// The Play versionCode for a release upload: seconds since 2026-01-01 UTC.
//
// Play's only real requirement is that the code strictly increases, and the
// hard part is that it must increase **in upload order**, which is not the same
// as run order. Two earlier attempts got this wrong:
//
//   $((10000 + GITHUB_RUN_NUMBER))  — inside a `workflow_call` run_number is the
//     CALLER's counter, so the first release-native.yml run numbered itself 1
//     and shipped 10001 against a live 10048. Play refused it.
//
//   <major>*10000000 + <build>*10000 + run_number*10 + run_attempt
//     — monotonic within one run lineage, but GitHub PRESERVES run_number when
//     you re-run an older workflow and only bumps run_attempt. Dispatch 1
//     uploads …010, dispatch 2 uploads …020, then "Re-run failed jobs" on
//     dispatch 1 computes …011 — below what Play already has, so the recovery
//     upload is refused and the retry wedge stays exactly where it was.
//
// Wall-clock is the only value that increases in upload order no matter how the
// runs are ordered, re-run, or interleaved. It is monotonic by construction
// rather than by an argument about GitHub's numbering, which is the property
// that kept being wrong.
//
// The cost, stated plainly: the code no longer encodes the version. That
// structure is what cannot survive an out-of-order re-run, so it had to go —
// versionName is what humans read in Play, and versionCode is an opaque
// ordering key, which is exactly what Google documents it as.
//
// Usage:
//   node scripts/android-version-code.mjs
//   node scripts/android-version-code.mjs --now 2026-09-04T12:00:00Z   # tests

// Recent enough that the count clears every legacy code on Play (small console
// codes, git-commit-count builds to ~8600, and the run_number era to 10048),
// and far enough from Play's 2100000000 ceiling for ~66 years.
const EPOCH_SECONDS = Date.UTC(2026, 0, 1) / 1000

// The highest code Play has already seen from the retired schemes. A computed
// code at or below it would be refused, and failing here beats a 30-minute
// build that dies at the upload step.
const LEGACY_FLOOR = 10048

const PLAY_MAX = 2100000000

export function versionCodeFor(now = new Date()) {
    const seconds = Math.floor(now.getTime() / 1000) - EPOCH_SECONDS

    if (!Number.isFinite(seconds)) throw new Error(`could not read a time from "${now}"`)
    if (seconds <= LEGACY_FLOOR) {
        throw new Error(
            `versionCode ${seconds} does not clear the legacy floor ${LEGACY_FLOOR} — is the runner clock before ${new Date(EPOCH_SECONDS * 1000).toISOString()}?`
        )
    }
    if (seconds > PLAY_MAX) throw new Error(`versionCode ${seconds} exceeds Play's maximum ${PLAY_MAX}`)

    return seconds
}

function flag(argv, name) {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
}

function main(argv) {
    const now = flag(argv, '--now')
    if (argv.includes('--now') && !now) throw new Error('--now needs a date')
    const at = now === undefined ? new Date() : new Date(/^\d+$/.test(now) ? Number(now) * 1000 : now)
    if (Number.isNaN(at.getTime())) throw new Error(`"${now}" is not a date`)
    return String(versionCodeFor(at))
}

if (process.argv[1] && process.argv[1].endsWith('android-version-code.mjs')) {
    try {
        process.stdout.write(`${main(process.argv.slice(2))}\n`)
    } catch (err) {
        console.error(`✗ android-version-code: ${err.message}`)
        process.exit(1)
    }
}
