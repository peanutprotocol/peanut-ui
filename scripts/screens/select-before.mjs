import { execFileSync } from 'node:child_process'
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { canReuseBaseline } from './baseline-reuse.mjs'
import { validateCapture, verifyAsset, hash } from './core.mjs'
import { findBaselineSource } from './baseline-source.mjs'
import { repositoryApiPath } from './repository-api.mjs'

const { REPOSITORY: repository, BEFORE: before, LOCALE: locale } = process.env
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !['en', 'es-419', 'es-AR', 'pt-BR'].includes(locale))
    throw new Error('Invalid baseline selection identity')
const [afterDir, destinationArg] = process.argv.slice(2)
const destination = resolve(destinationArg)
const api = (path) =>
    JSON.parse(
        execFileSync('gh', ['api', repositoryApiPath(repository, path)], {
            encoding: 'utf8',
            timeout: 60000,
            maxBuffer: 64 * 1024 * 1024,
        })
    )
const source = findBaselineSource({ api, repository, expectedCommit: before })
let reused = false
let reason = 'No retained compatible candidate in the verified baseline cache search; capture before once'
if (source) {
    const artifact = source.artifacts.find(
        (entry) =>
            entry.name.includes(`-${locale}-`) || (locale === 'en' && /^screen-library-after-\d+$/.test(entry.name))
    )
    if (!artifact) throw new Error('Verified baseline is missing selected locale')
    const directory = resolve(`baseline-${locale}`)
    console.log(`Baseline phase=download locale=${locale} source-run=${source.run.id} budget=180s`)
    // Download/provider failures are visible. They are not cache absence or safe skips.
    execFileSync(
        'gh',
        ['run', 'download', String(source.run.id), '--repo', repository, '--name', artifact.name, '--dir', directory],
        {
            stdio: 'inherit',
            timeout: 180000,
        }
    )
    try {
        const bytes = readFileSync(join(directory, 'capture.json'))
        const capture = validateCapture(JSON.parse(bytes))
        const after = validateCapture(JSON.parse(readFileSync(join(afterDir, 'capture.json'), 'utf8')))
        if (!canReuseBaseline(capture, after, before))
            throw new Error('Baseline manifest identities, completeness or selected state coverage differ')
        for (const screen of capture.screens)
            if (screen.status === 'captured')
                for (const name of [screen.image, screen.thumbnail])
                    verifyAsset(join(directory, 'assets'), name, capture)
        mkdirSync(join(destination, 'assets'), { recursive: true })
        for (const screen of capture.screens)
            if (screen.status === 'captured')
                for (const name of [screen.image, screen.thumbnail])
                    copyFileSync(join(directory, 'assets', name), join(destination, 'assets', name))
        writeFileSync(join(destination, 'capture.json'), bytes)
        writeFileSync(
            join(destination, 'baseline-source.json'),
            JSON.stringify({
                schema: 1,
                runId: String(source.run.id),
                artifact: artifact.name,
                manifestDigest: hash(bytes),
                commit: before,
                locale,
            })
        )
        reused = true
        reason = `Reused verified full ${locale} baseline from run ${source.run.id}; original capture provenance retained`
    } catch (error) {
        rmSync(destination, { recursive: true, force: true })
        reason = `Baseline candidate rejected: ${error.message}; capture before once`
    }
}
console.log(reason)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `reused=${reused}\n`)
