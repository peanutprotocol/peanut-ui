/** Run only from a trusted checkout, in a job that never executes PR code. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { compare, validateCapture, verifyAsset } from './core.mjs'
import { createStorage } from './cloudflare-storage.mjs'
import { updateIndexes } from './publication-index.mjs'

const immutableReportPath =
    /^\d{4}-\d{2}-\d{2}\/((?:dev|main)-[a-f0-9]{40}|compare-dev\/[a-f0-9]{40}|pr-[1-9][0-9]*\/[a-f0-9]{40}|compare-main-\d{4}-\d{2}-\d{2}\/[a-f0-9]{40})(?:\/run-[0-9]+-[0-9]+)?$/

export async function publishReport({ inputDir, reportPath, env = process.env, storage } = {}) {
    if (!immutableReportPath.test(reportPath ?? '')) throw new Error('Invalid immutable report path')
    const { put, list, read, preview } = storage ?? (await createStorage(env))
    const { default: sharp } = await import('sharp')
    const dir = resolve(inputDir),
        assets = join(dir, 'assets')
    const input = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
    // Recompute every classification. The downloaded report is untrusted data.
    const report = input.type === 'capture' ? validateCapture(input) : compare(input.before, input.after, assets)
    const after = report.type === 'capture' ? report : report.after
    if (!reportPath.replace(/\/run-[0-9]+-[0-9]+$/, '').endsWith(after.commit))
        throw new Error('Report path does not match captured commit')
    if (env.EXPECTED_HEAD && after.commit !== env.EXPECTED_HEAD) throw new Error('Head differs from triggering run')
    if (env.EXPECTED_BASE && report.before?.commit !== env.EXPECTED_BASE)
        throw new Error('Base differs from verified comparison')
    const refs = new Set()
    for (const capture of report.type === 'capture' ? [report] : [report.before, report.after])
        for (const screen of capture.screens)
            if (screen.status === 'captured') {
                refs.add(screen.image)
                refs.add(screen.thumbnail)
            }
    if (report.type === 'comparison') for (const screen of report.screens) if (screen.diff) refs.add(screen.diff)
    const options = { allowOverwrite: false }
    const previewUrls = {}
    async function immutable(path, body, contentType) {
        // Conflict on a rerun is acceptable only when the remote bytes agree.
        try {
            return await put(path, body, { ...options, contentType })
        } catch (error) {
            const existing = await list({ prefix: path, limit: 2 })
            const item = existing.blobs.find((blob) => blob.pathname === path)
            if (!item) throw error
            if (!(await read(path)).equals(Buffer.isBuffer(body) ? body : Buffer.from(body)))
                throw new Error(`Immutable object conflict: ${path}`)
            return item
        }
    }
    const offline = mkdtempSync(join(tmpdir(), 'peanut-screens-offline-'))
    try {
        mkdirSync(join(offline, 'assets'))
        for (const name of refs) {
            const bytes = verifyAsset(assets, name)
            if (name.endsWith('.webp')) {
                const meta = await sharp(bytes, { limitInputPixels: 393 * 852 }).metadata()
                if (meta.width !== 197 || meta.height !== 427) throw new Error('Invalid thumbnail dimensions')
            }
            previewUrls[name] = await preview(name, bytes)
            copyFileSync(join(assets, name), join(offline, 'assets', name))
        }
        const json = JSON.stringify(report)
        writeFileSync(join(offline, 'manifest.json'), json)
        // JSON is escaped for a JS data file; it is not accepted from the PR artifact.
        writeFileSync(
            join(offline, 'report.js'),
            `window.SCREEN_REPORT=${json
                .replace(/</g, '\\u003c')
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029')};`
        )
        const html = readFileSync('public/screen-library/index.html', 'utf8')
            .replaceAll('/screen-library/', './')
            .replace(
                '<script defer src="./viewer.js">',
                '<script src="./report.js"></script><script defer src="./viewer.js">'
            )
        writeFileSync(join(offline, 'index.html'), html)
        for (const name of ['viewer.js', 'viewer.css'])
            copyFileSync(`public/screen-library/${name}`, join(offline, name))
        // Relative entries only; filenames were validated above. Archive built by trusted code.
        execFileSync('tar', ['-czf', join(dir, 'offline.tar.gz'), '-C', offline, '.'])
        const archivePath = `reports/${reportPath}/offline.tar.gz`
        const priorArchive = await list({ prefix: archivePath, limit: 2 })
        if (!priorArchive.blobs.some((blob) => blob.pathname === archivePath))
            await immutable(archivePath, readFileSync(join(dir, 'offline.tar.gz')), 'application/gzip')
        // Commit marker last. Incomplete captures remain explicitly incomplete in the viewer.
        const manifest = await immutable(
            `reports/${reportPath}/manifest.json`,
            JSON.stringify({ ...report, previewUrls }),
            'application/json'
        )
        const date = reportPath.slice(0, 10)
        await immutable(
            `entries/${reportPath.replaceAll('/', '_')}.json`,
            JSON.stringify({
                path: reportPath,
                date,
                label: reportPath.slice(11),
                complete: report.complete,
                sequence: Number(env.DEV_SEQUENCE ?? 0),
                attempt: Number(env.RUN_ATTEMPT ?? 0),
                captureAttempt: Number(env.CAPTURE_ATTEMPT ?? 0),
            }),
            'application/json'
        )
        await updateIndexes({ put, list, read })
        console.log(`${env.SCREEN_LIBRARY_PUBLIC_URL}/screens/${reportPath}/`)
        console.log(`Storage manifest: ${manifest.url}`)
        return { report, manifest }
    } finally {
        rmSync(offline, { recursive: true, force: true })
    }
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) await publishReport({ inputDir: process.argv[2], reportPath: process.argv[3] })
