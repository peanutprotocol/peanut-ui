#!/usr/bin/env node
// Lets release-ota.yml skip a main push whose app bundle production already
// serves: no OTA, no version number, no tag and no store build. Seven tester
// builds of an unchanged app went out on 23-25 Nov 2026.
//
// Two builds of one commit never produce the same bytes, so Capgo's checksum
// (of the uploaded zip) cannot answer this. Every export bakes in values that
// change on each run: the Next build id, the commit (NEXT_PUBLIC_GIT_COMMIT_HASH),
// the OTA display version and the Sentry debug ids. Webpack names chunks by a
// hash of their content, so a chunk that holds one of those values gets a new
// file name, and so does every file that names it.
//
// `digest` hashes out/ with those values blanked, and replaces each chunk file
// name hash with a hash of that chunk's own normalized content. Any other
// change to any file still changes the digest. The release tag records it.
//
// `compare` exits 0 only when every given live commit (the source of the bundle
// each production channel serves, read from Capgo) has an OTA tag with this
// digest and a native release tag, and main changed only paths whose sole way
// into the app is out/ since then. Exit 1 means "release as usual"; the
// workflow treats every error the same way.
//
// Usage (inside the app checkout):
//   node scripts/ota-bundle-digest.mjs digest <out-dir> <volatile-value>...
//   node scripts/ota-bundle-digest.mjs compare <digest> <live-sha>...

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEXT = /\.(?:html|js|mjs|css|txt|json|xml|svg|webmanifest)$/i
// Next names JS and CSS chunks <name>-<hash>.js, <id>.<hash>.js or <hash>.css.
// Media keep their 8-character name hash: it is a hash of the file itself.
const HASHED = /(?:^|[-.])([0-9a-f]{16,64})\.(?:js|css)$/
const DEBUG_ID = /debugId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g
const SHA = /^[0-9a-f]{40}$/
const DIGEST_LINE = /^bundle-digest: (sha256:[0-9a-f]{64})$/m
// Store builds also package android/, ios/, the Capacitor config, the lockfile
// and patches; workflows and scripts decide how both builds run. Only these
// paths reach the app through out/ alone, so out/ shows all they change.
const OUT_ONLY = [/^src\//, /^public\//, /^e2e\//, /^docs\//, /\.md$/]

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

function listFiles(dir, prefix = '') {
    const files = []
    for (const entry of readdirSync(join(dir, prefix)).sort()) {
        const rel = prefix ? `${prefix}/${entry}` : entry
        const stat = lstatSync(join(dir, rel))
        if (stat.isDirectory()) files.push(...listFiles(dir, rel))
        else if (stat.isFile()) files.push(rel)
        else throw new Error(`unexpected file type at ${rel}`)
    }
    return files
}

export function bundleDigest(outDir, volatile) {
    // A short value would blank unrelated text and could hide a real change.
    if (!volatile.length || volatile.some((value) => typeof value !== 'string' || value.length < 5)) {
        throw new Error('every volatile value must be at least 5 characters')
    }
    const files = listFiles(outDir)
    if (!files.includes('index.html')) throw new Error(`${outDir} has no index.html`)
    const raw = new Map(files.map((file) => [file, readFileSync(join(outDir, file))]))

    const tokens = new Map()
    for (const file of files) {
        const token = HASHED.exec(posix.basename(file))?.[1]
        if (!token) continue
        if (tokens.has(token)) throw new Error(`two chunks share the hash ${token}`)
        tokens.set(token, file)
    }
    const blank = (text) => volatile.reduce((result, value, i) => result.split(value).join(`<volatile:${i}>`), text)
    // One scan for hex runs with a map lookup: an alternation of every chunk
    // hash would be slow on a full export. A run that is no chunk hash stays.
    const normalize = (text, ids, self) => {
        for (const [, id] of text.matchAll(DEBUG_ID)) text = text.split(id).join('<debug-id>')
        text = text.replace(/[0-9a-f]{16,64}/g, (t) =>
            !tokens.has(t) ? t : t === self ? '<self>' : `<chunk:${ids.get(t)}>`
        )
        return blank(text)
    }

    // A chunk's id depends on the ids of the chunks it names. Repeat until the
    // ids settle; chunk references that form a cycle never do, and throw.
    let ids = new Map([...tokens.keys()].map((token) => [token, '']))
    for (let pass = 0; ; pass++) {
        if (pass > 50) throw new Error('chunk references do not settle')
        const next = new Map(
            [...tokens].map(([token, file]) => [token, sha256(normalize(raw.get(file).toString('utf8'), ids, token))])
        )
        if ([...next].every(([token, id]) => ids.get(token) === id)) break
        ids = next
    }

    const lines = files.map((file) => {
        const self = HASHED.exec(posix.basename(file))?.[1]
        const content = TEXT.test(file) ? normalize(raw.get(file).toString('utf8'), ids, self) : raw.get(file)
        return `${normalize(file, ids)}\t${sha256(content)}`
    })
    return `sha256:${sha256(lines.sort().join('\n'))}`
}

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

// Returns null when production serves this bundle, else why it may not be skipped.
export function whyRelease(digest, liveShas) {
    if (!/^sha256:[0-9a-f]{64}$/.test(digest ?? '')) return `no valid bundle digest ("${digest ?? ''}")`
    if (!liveShas.length) return 'no live source commit'
    for (const live of liveShas) {
        if (!SHA.test(live)) return `"${live}" is not a full commit SHA`
        try {
            git('merge-base', '--is-ancestor', live, 'HEAD')
        } catch {
            return `this commit does not contain the live source ${live.slice(0, 7)}`
        }
        const changed = git('diff', '--name-only', '--no-renames', live, 'HEAD').split('\n').filter(Boolean)
        const beyond = changed.filter((file) => !OUT_ONLY.some((pattern) => pattern.test(file)))
        if (beyond.length)
            return `changes since ${live.slice(0, 7)} reach the app outside out/: ${beyond.slice(0, 5).join(', ')}`
        // Without a store build of the live commit, this run's store build is
        // the one that makes it.
        if (!git('tag', '--points-at', live, '--list', 'v*')) return `${live.slice(0, 7)} has no native release tag`
        const otaTags = git('tag', '--points-at', live, '--list', 'ota-*').split('\n').filter(Boolean)
        if (!otaTags.length) return `${live.slice(0, 7)} has no OTA tag`
        for (const tag of otaTags) {
            const recorded = DIGEST_LINE.exec(git('tag', '--list', '--format=%(contents)', tag))?.[1]
            if (recorded !== digest) return `${tag} records ${recorded ?? 'no bundle digest'}, not ${digest}`
        }
    }
    return null
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const [mode, first, ...rest] = process.argv.slice(2)
    try {
        if (mode === 'digest') {
            console.log(bundleDigest(first, rest))
        } else if (mode === 'compare') {
            const reason = whyRelease(first, rest)
            if (reason) {
                console.log(`Releasing: ${reason}`)
                process.exitCode = 1
            } else {
                console.log(
                    `Production already serves bundle ${first} (from ${rest.map((s) => s.slice(0, 7)).join(', ')})`
                )
            }
        } else {
            throw new Error(`unknown mode: ${mode}`)
        }
    } catch (error) {
        console.error(`ota-bundle-digest: ${error.message}`)
        process.exitCode = 1
    }
}
