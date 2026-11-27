#!/usr/bin/env node
// Keeps the TLA+ specs in verification/tla/ in step with the code they model.
//
// Each spec names the files it models in its header: `Models: src/a.ts, src/b.ts`. When a branch
// changes one of those files and changes no spec or config that names it, this fails, unless a
// commit on the branch carries the trailer `Model-unchanged: <reason>` (the change does not touch
// what the model describes). A path that does not exist yet is a warning, so a spec can name a
// module that a parallel change is about to add.
//
// usage: node scripts/check-model-sync.mjs --base-ref <ref>   (CI: the tla job, on a pull request)
// What TLA+ checks and how to add a model: mono engineering/api/state-machines/README.md.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SPEC_DIR = 'verification/tla'
const TRAILER = 'Model-unchanged'

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

/** spec name -> the repo paths its `Models:` lines name. */
function readModels(root) {
    const models = new Map()
    for (const file of readdirSync(join(root, SPEC_DIR))) {
        if (!file.endsWith('.tla') || file === 'Generated.tla') continue
        const text = readFileSync(join(root, SPEC_DIR, file), 'utf8')
        const paths = [...text.matchAll(/^\s*Models:\s*(.+)$/gm)].flatMap((m) =>
            m[1]
                .split(',')
                .map((p) => p.trim().replace(/\.$/, ''))
                .filter(Boolean)
        )
        models.set(file.replace(/\.tla$/, ''), paths)
    }
    return models
}

function main() {
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim()
    const at = process.argv.indexOf('--base-ref')
    const baseRef = at > 0 ? process.argv[at + 1] : undefined

    const models = readModels(root)
    let failed = false
    for (const [spec, paths] of models) {
        if (paths.length === 0) {
            console.error(
                `::error file=${SPEC_DIR}/${spec}.tla::${spec}.tla has no "Models:" line naming the code it models.`
            )
            failed = true
        }
        for (const path of paths.filter((p) => !existsSync(join(root, p))))
            console.warn(`::warning file=${SPEC_DIR}/${spec}.tla::${spec}.tla models ${path}, which does not exist.`)
    }
    if (failed) process.exit(1)

    if (!baseRef) {
        console.log('check-model-sync: no --base-ref (not a pull request), so only the Models: lines were checked.')
        return
    }

    const mergeBase = git(root, ['merge-base', baseRef, 'HEAD']).trim()
    const changed = new Set(
        git(root, ['diff', '--name-only', '--no-renames', mergeBase, 'HEAD']).split('\n').filter(Boolean)
    )
    const specChanged = (spec) =>
        [...changed].some(
            (f) => f === `${SPEC_DIR}/${spec}.tla` || (f.startsWith(`${SPEC_DIR}/${spec}_`) && f.endsWith('.cfg'))
        )

    const unsynced = []
    for (const file of changed) {
        const naming = [...models].filter(([, paths]) => paths.includes(file)).map(([spec]) => spec)
        const missing = naming.filter((spec) => !specChanged(spec))
        if (missing.length > 0) unsynced.push({ file, specs: missing })
    }
    if (unsynced.length === 0) {
        console.log(`check-model-sync: ${changed.size} changed files, every modelled one changed with its spec.`)
        return
    }

    const reasons = git(root, ['log', `--format=%(trailers:key=${TRAILER},valueonly)`, `${mergeBase}..HEAD`])
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    for (const { file, specs } of unsynced) {
        const where = specs.map((s) => `${SPEC_DIR}/${s}.tla`).join(', ')
        if (reasons.length > 0)
            console.log(`check-model-sync: ${file} changed without ${where}; ${TRAILER}: ${reasons.join(' | ')}`)
        else console.error(`::error file=${file}::${file} is modelled by ${where}, which this branch does not change.`)
    }
    if (reasons.length > 0) return
    console.error(
        `Update the spec and run verification/tla/check-all.sh, or, if the change leaves the modelled behaviour as it is, add a commit trailer "${TRAILER}: <why>".`
    )
    process.exit(1)
}

main()
