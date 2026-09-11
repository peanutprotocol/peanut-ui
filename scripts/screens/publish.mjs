/** Run only from a trusted checkout, in a job that never executes PR code. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { compare, validateCapture, verifyAsset } from './core.mjs'
const [inputDir, reportPath] = process.argv.slice(2)
if (
    !/^\d{4}-\d{2}-\d{2}\/((?:dev|main)-[a-f0-9]{40}|compare-dev\/[a-f0-9]{40}|pr-[1-9][0-9]*\/[a-f0-9]{40}|compare-main-\d{4}-\d{2}-\d{2}\/[a-f0-9]{40})(?:\/run-[0-9]+-[0-9]+)?$/.test(
        reportPath ?? ''
    )
)
    throw new Error('Invalid immutable report path')
import { createStorage } from './cloudflare-storage.mjs'
const { put, list, read, preview } = await createStorage()
const { default: sharp } = await import('sharp')
const dir = resolve(inputDir),
    assets = join(dir, 'assets')
const input = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
// Recompute every classification. The downloaded report is untrusted data.
const report = input.type === 'capture' ? validateCapture(input) : compare(input.before, input.after, assets)
const after = report.type === 'capture' ? report : report.after
if (!reportPath.replace(/\/run-[0-9]+-[0-9]+$/, '').endsWith(after.commit))
    throw new Error('Report path does not match captured commit')
if (process.env.EXPECTED_HEAD && after.commit !== process.env.EXPECTED_HEAD)
    throw new Error('Head differs from triggering run')
if (process.env.EXPECTED_BASE && report.before?.commit !== process.env.EXPECTED_BASE)
    throw new Error('Base differs from verified comparison')
const refs = new Set()
for (const capture of report.type === 'capture' ? [report] : [report.before, report.after])
    for (const s of capture.screens)
        if (s.status === 'captured') {
            refs.add(s.image)
            refs.add(s.thumbnail)
        }
if (report.type === 'comparison') for (const s of report.screens) if (s.diff) refs.add(s.diff)
const options = { allowOverwrite: false }
const previewUrls = {}
async function immutable(path, body, contentType) {
    // Conflict on a rerun is acceptable only when the remote bytes agree.
    try {
        return await put(path, body, { ...options, contentType })
    } catch (error) {
        const existing = await list({ prefix: path, limit: 2 })
        const item = existing.blobs.find((b) => b.pathname === path)
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
    for (const name of ['viewer.js', 'viewer.css']) copyFileSync(`public/screen-library/${name}`, join(offline, name))
    // Relative entries only; filenames were validated above. Archive built by trusted code.
    execFileSync('tar', ['-czf', join(dir, 'offline.tar.gz'), '-C', offline, '.'])
    const archivePath = `reports/${reportPath}/offline.tar.gz`
    const priorArchive = await list({ prefix: archivePath, limit: 2 })
    if (!priorArchive.blobs.some((b) => b.pathname === archivePath))
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
            sequence: Number(process.env.DEV_SEQUENCE ?? 0),
            attempt: Number(process.env.RUN_ATTEMPT ?? 0),
        }),
        'application/json'
    )
    const entries = []
    let cursor
    do {
        const page = await list({ prefix: 'entries/', cursor })
        for (const b of page.blobs) {
            entries.push(JSON.parse((await read(b.pathname)).toString('utf8')))
        }
        cursor = page.cursor
        if (!page.hasMore) break
    } while (cursor)
    entries.sort(
        (a, b) =>
            (b.sequence ?? 0) - (a.sequence ?? 0) || (b.attempt ?? 0) - (a.attempt ?? 0) || b.path.localeCompare(a.path)
    )
    await put('index.json', JSON.stringify(entries), {
        ...options,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: 'application/json',
    })
    // A PR completion must never move latest; only complete dev reports qualify.
    const latest = entries.find((e) => e.complete && /^\d{4}-\d{2}-\d{2}\/dev-/.test(e.path))
    if (latest)
        await put('latest.json', JSON.stringify({ path: latest.path }), {
            ...options,
            allowOverwrite: true,
            cacheControlMaxAge: 60,
            contentType: 'application/json',
        })
    console.log(`${process.env.SCREEN_LIBRARY_PUBLIC_URL}/screens/${reportPath}/`)
    console.log(`Storage manifest: ${manifest.url}`)
} finally {
    rmSync(offline, { recursive: true, force: true })
}
