#!/usr/bin/env node
// Decides whether a release may keep building its source commit after `main`
// moved. Exits 0 when <main-tip> is <source> or a descendant of it whose only
// change is the src/content submodule pointer. Exits 1 in every other case,
// including any git error, so a caller under `set -e` stops the release.
//
// Usage: node scripts/release-source-guard.mjs <source-sha> <main-tip-sha>
// Run it inside the app checkout. When <main-tip> is not in the checkout (a
// shallow clone, or a commit pushed after the checkout), it is fetched from
// `origin` first.
//
// Why content is the exception: content-publish-automerge.yml merges content
// publishes to main with no human step, and those pushes do not start a release
// (paths-ignore in release-ota.yml). A release that stopped on such a push would
// therefore never ship, and no later run would replace it. The release keeps
// shipping its source commit; the new content reaches the web through Vercel and
// the app with the next code release.

import { execFileSync } from 'node:child_process'

const CONTENT_SUBMODULE = 'src/content'

const SHA = /^[0-9a-f]{40}$/

const [source, tip] = process.argv.slice(2)

try {
    if (!SHA.test(source ?? '') || !SHA.test(tip ?? '')) {
        throw new Error(`expected two full commit SHAs, got "${source ?? ''}" and "${tip ?? ''}"`)
    }
    if (source === tip) {
        console.log(`main is still ${source.slice(0, 7)}`)
        process.exit(0)
    }
    if (!hasCommit(tip)) git('fetch', '--no-tags', '--no-recurse-submodules', '--quiet', 'origin', tip)
    if (!isAncestor(source, tip)) {
        throw new Error(`main tip ${tip.slice(0, 7)} does not contain ${source.slice(0, 7)}`)
    }
    const changed = git('diff', '--name-only', '--no-renames', source, tip).split('\n').filter(Boolean)
    const beyondContent = changed.filter((file) => file !== CONTENT_SUBMODULE)
    if (beyondContent.length > 0) {
        throw new Error(
            `main moved from ${source.slice(0, 7)} to ${tip.slice(0, 7)} with changes beyond ${CONTENT_SUBMODULE}: ${beyondContent.slice(0, 10).join(', ')}`
        )
    }
    console.log(
        `main moved from ${source.slice(0, 7)} to ${tip.slice(0, 7)} by ${CONTENT_SUBMODULE} only; the release keeps ${source.slice(0, 7)}`
    )
} catch (err) {
    console.error(`✗ release-source-guard: ${err.message}`)
    process.exit(1)
}

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function hasCommit(sha) {
    try {
        git('cat-file', '-e', `${sha}^{commit}`)
        return true
    } catch {
        return false
    }
}

function isAncestor(ancestor, descendant) {
    try {
        git('merge-base', '--is-ancestor', ancestor, descendant)
        return true
    } catch {
        return false
    }
}
