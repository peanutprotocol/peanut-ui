#!/usr/bin/env node
// Keeps the TLA+ specs in verification/tla/ in step with the code they model.
//
// Each spec names the files it models in its header: `Models: src/a.ts, src/b.ts`. Every named
// path must exist, every spec must carry at least one holding `.cfg` and one `*_Buggy*.cfg`, and
// every `*_Buggy*.cfg` must carry a `\* Replay: <test-path>` (or `OPEN_GAP` / `ARCHITECTURAL`).
// When a branch changes a modelled file and changes no spec or config that names it, this fails,
// unless a commit on the branch carries the trailer `Model-unchanged: <reason>`.
//
// usage: node scripts/check-model-sync.mjs --base-ref <ref>   (CI: the tla job, on a pull request)
// What TLA+ checks and how to add a model: mono engineering/api/state-machines/README.md.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SPEC_DIR = 'verification/tla'
const TRAILER = 'Model-unchanged'

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

function replayTitleExists(testText, title) {
    const trimmed = title.trim()
    if (!trimmed) return false
    if (testText.includes(trimmed)) return true
    if (/%[sdifjoO]/.test(trimmed)) {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%[sdifjoO]/g, '.+')
        return new RegExp(escaped).test(testText)
    }
    return false
}

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

function readConfigs(root, spec) {
    const dir = join(root, SPEC_DIR)
    return readdirSync(dir)
        .filter((f) => f.endsWith('.cfg') && (f === `${spec}.cfg` || f.startsWith(`${spec}_`)))
        .sort()
}

function main() {
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim()
    const at = process.argv.indexOf('--base-ref')
    const baseRef = at > 0 ? process.argv[at + 1] : undefined

    const models = readModels(root)
    let failed = false
    for (const [spec, paths] of models) {
        const specFile = `${SPEC_DIR}/${spec}.tla`
        if (paths.length === 0) {
            console.error(`::error file=${specFile}::${spec}.tla has no "Models:" line naming the code it models.`)
            failed = true
        }
        for (const path of paths.filter((p) => !existsSync(join(root, p)))) {
            console.error(`::error file=${specFile}::${spec}.tla models ${path}, which does not exist.`)
            failed = true
        }
        const cfgs = readConfigs(root, spec)
        const buggyCfgs = cfgs.filter((c) => /_Buggy/i.test(c))
        const holdingCfgs = cfgs.filter((c) => !/_Buggy/i.test(c))
        if (holdingCfgs.length === 0 || buggyCfgs.length === 0) {
            console.error(
                `::error file=${specFile}::${spec}.tla needs at least one holding .cfg and one *_Buggy*.cfg (found ${holdingCfgs.length} holding, ${buggyCfgs.length} buggy).`
            )
            failed = true
        }
        for (const cfg of buggyCfgs) {
            const cfgText = readFileSync(join(root, SPEC_DIR, cfg), 'utf8')
            const replay = cfgText.match(/^\s*\\\*\s*Replay:\s*(.+)$/m)
            if (!replay) {
                console.error(
                    `::error file=${SPEC_DIR}/${cfg}::${cfg} needs a "\\* Replay: <test-path> › <test-title>" (or OPEN_GAP(TASK-...) / ARCHITECTURAL(...)) line.`
                )
                failed = true
            } else {
                const rawTarget = replay[1].trim()
                if (/^(OPEN_GAP\(TASK-\d+\)|ARCHITECTURAL\()/.test(rawTarget)) continue
                const segments = rawTarget
                    .split(/[›>]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                const testFile = segments[0]?.split(/\s+/)[0]
                if (!testFile || !existsSync(join(root, testFile))) {
                    console.error(
                        `::error file=${SPEC_DIR}/${cfg}::${cfg} Replay target "${testFile ?? rawTarget}" does not exist.`
                    )
                    failed = true
                } else if (segments.length >= 2) {
                    const testTitle = segments[segments.length - 1]
                    const testText = readFileSync(join(root, testFile), 'utf8')
                    if (!replayTitleExists(testText, testTitle)) {
                        console.error(
                            `::error file=${SPEC_DIR}/${cfg}::${cfg} Replay test title "${testTitle}" was not found in ${testFile}.`
                        )
                        failed = true
                    }
                }
            }
        }
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

    // Scope Model-unchanged trailers strictly to commits that actually touched each unsynced file.
    let missingTrailer = false
    const summaryLines = []
    for (const { file, specs } of unsynced) {
        const where = specs.map((s) => `${SPEC_DIR}/${s}.tla`).join(', ')
        const fileReasons = git(root, [
            'log',
            `--format=%(trailers:key=${TRAILER},valueonly)`,
            `${mergeBase}..HEAD`,
            '--',
            file,
        ])
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        if (fileReasons.length > 0) {
            const joined = fileReasons.join(' | ')
            console.log(`check-model-sync: ${file} changed without ${where}; ${TRAILER}: ${joined}`)
            summaryLines.push(`- \`${file}\` (without \`${where}\`): ${joined}`)
        } else {
            console.error(`::error file=${file}::${file} is modelled by ${where}, which this branch does not change.`)
            missingTrailer = true
        }
    }
    if (summaryLines.length > 0 && process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(
            process.env.GITHUB_STEP_SUMMARY,
            `\n### Model-unchanged declarations (verify in review)\n${summaryLines.join('\n')}\n`
        )
    }
    if (!missingTrailer) return
    console.error(
        `Update the spec and run verification/tla/check-all.sh, or, if the change leaves the modelled behaviour as it is, add a commit trailer "${TRAILER}: <why>" on the commit touching that file.`
    )
    process.exit(1)
}

main()
