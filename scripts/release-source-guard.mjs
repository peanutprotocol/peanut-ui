#!/usr/bin/env node
// Decides whether a release may keep building its source commit after `main`
// moved. Exits 0 when <main-tip> is <source> or a descendant of it that changes
// only web-only paths (release-web-only-paths.json). Exits 1 in every other
// case, including any git error, so a caller under `set -e` stops the release.
//
// Usage: node scripts/release-source-guard.mjs <source-sha> <main-tip-sha>
// Run it inside the app checkout. When <main-tip> is not in the checkout (a
// shallow clone, or a commit pushed after the checkout), it is fetched from
// `origin` first.
//
// Why web-only paths are the exception: a push that changes only them starts no
// release (release-ota.yml `paths-ignore` holds the same list, and a test keeps
// the two equal). A release that stopped on such a push would therefore never
// ship, and no later run would replace it. The release keeps shipping its source
// commit; the change reaches the web through Vercel. The list:
// - src/content: the content submodule pointer. content-publish-automerge.yml
//   merges content publishes to main with no human step; the app gets the new
//   content with the next code release.
// - the /go/ redirect map and the creator landing pages (/c/): the native build
//   removes their routes and images (scripts/native-build.js), and ESLint and
//   release-web-only-paths.test.js stop other code from referencing their
//   feature folders, so no app bundle contains them.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// A pattern is an exact path, or `<dir>/**` for every file under <dir>. Any
// other glob throws, so a list entry this guard cannot read stops the release.
const WEB_ONLY_PATHS = JSON.parse(readFileSync(new URL('./release-web-only-paths.json', import.meta.url), 'utf8'))

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
    const beyondWebOnly = changed.filter((file) => !WEB_ONLY_PATHS.some((pattern) => matches(pattern, file)))
    if (beyondWebOnly.length > 0) {
        throw new Error(
            `main moved from ${source.slice(0, 7)} to ${tip.slice(0, 7)} with changes beyond the web-only paths: ${beyondWebOnly.slice(0, 10).join(', ')}`
        )
    }
    console.log(
        `main moved from ${source.slice(0, 7)} to ${tip.slice(0, 7)} by web-only paths only; the release keeps ${source.slice(0, 7)}`
    )
} catch (err) {
    console.error(`✗ release-source-guard: ${err.message}`)
    process.exit(1)
}

// GitHub path filters read [ and ] as a character class, so a literal bracket
// folder such as [locale] is written escaped (\[locale\]) in paths-ignore and here.
function literal(pattern) {
    return pattern.replace(/\\([[\]])/g, '$1')
}

function hasGlob(pattern) {
    return /[*?!+]|(?<!\\)[[\]]/.test(pattern)
}

function matches(pattern, file) {
    if (pattern.endsWith('/**') && !hasGlob(pattern.slice(0, -3))) {
        return file.startsWith(literal(pattern.slice(0, -2)))
    }
    if (hasGlob(pattern)) throw new Error(`cannot read the web-only path pattern "${pattern}"`)
    return file === literal(pattern)
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
