/** Run only from a trusted checkout, in a job that never executes PR code. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { compare, hash, validateCapture, validateJourneys, verifyAsset } from './core.mjs'
import { createStorage } from './cloudflare-storage.mjs'
import { updateIndexes } from './publication-index.mjs'

const immutableReportPath =
    /^\d{4}-\d{2}-\d{2}\/((?:dev|main)-[a-f0-9]{40}|(?:dev|main)\/(?:en|es-419|es-ar|pt-br)\/(?:440x956|360x800|320x712)\/[a-f0-9]{40}|(?:dev|main)\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40}|compare-dev\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40}|pr-[1-9][0-9]*\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40}|compare-main-\d{4}-\d{2}-\d{2}\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40}|nutcracker\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40})(?:\/run-[0-9]+-[0-9]+)?$/

const localeInfo = {
    en: { slug: 'en', label: 'English' },
    'es-419': { slug: 'es-419', label: 'Español' },
    'es-AR': { slug: 'es-ar', label: 'Español (Argentina)' },
    'pt-BR': { slug: 'pt-br', label: 'Português (Brasil)' },
}
const visualChangeStatuses = new Set(['changed', 'added', 'removed'])

async function mapBounded(values, operation, limit = 8) {
    const output = new Array(values.length)
    let cursor = 0
    await Promise.all(
        Array.from({ length: Math.min(limit, values.length) }, async () => {
            while (cursor < values.length) {
                const index = cursor++
                output[index] = await operation(values[index])
            }
        })
    )
    return output
}

/** Load immutable asset keys once per publishing run so existing images are
 * reused without a failing conditional PUT and verification GET per report. */
export async function existingAssetPaths(storage) {
    const paths = new Set()
    let cursor
    do {
        const page = await storage.list({ prefix: 'assets/', cursor })
        for (const blob of page.blobs) paths.add(blob.pathname)
        cursor = page.cursor
        if (!page.hasMore) break
    } while (cursor)
    return paths
}

function optionalInteger(value, label, { positive = false } = {}) {
    if (value === undefined || value === null || value === '') return undefined
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || (positive ? parsed < 1 : parsed < 0)) throw new Error(`Invalid ${label}`)
    return parsed
}

function entryMetadata(report, reportPath, env) {
    const channel = reportPath.split('/')[1] ?? ''
    const fallbackBranch = channel.startsWith('dev') ? 'dev' : channel.startsWith('main') ? 'main' : channel
    const configuredBranch = env.SOURCE_BRANCH?.trim()
    if (configuredBranch && (configuredBranch.length > 255 || /[\u0000-\u001f\u007f]/.test(configuredBranch)))
        throw new Error('Invalid source branch')
    const pathPr = /^pr-([1-9][0-9]*)$/.exec(channel)
    const prNumber = optionalInteger(env.PR_NUMBER ?? pathPr?.[1], 'PR number', { positive: true })
    const changedScreens =
        report.type === 'comparison'
            ? report.screens.filter((screen) => visualChangeStatuses.has(screen.status)).length
            : optionalInteger(env.CHANGED_SCREENS, 'changed screen count')
    return {
        reportType: report.type,
        branch: configuredBranch || fallbackBranch,
        ...(prNumber === undefined ? {} : { prNumber }),
        ...(changedScreens === undefined ? {} : { changedScreens }),
    }
}

export async function publishReport({
    inputDir,
    reportPath,
    env = process.env,
    storage,
    knownAssets,
    assetWrites = new Map(),
    assetConversions = new Map(),
    updateSharedIndexes = true,
} = {}) {
    if (!immutableReportPath.test(reportPath ?? '')) throw new Error('Invalid immutable report path')
    const activeStorage = storage ?? (await createStorage(env))
    const { put, list, read } = activeStorage
    const { default: sharp } = await import('sharp')
    const dir = resolve(inputDir),
        assets = join(dir, 'assets')
    const input = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
    // Recompute every classification. The downloaded report is untrusted data.
    const report =
        input.type === 'capture'
            ? validateCapture(input)
            : input.type === 'journeys'
              ? validateJourneys(input)
              : compare(input.before, input.after, assets)
    const after = report.type === 'comparison' ? report.after : report
    if (!reportPath.replace(/\/run-[0-9]+-[0-9]+$/, '').endsWith(after.commit))
        throw new Error('Report path does not match captured commit')
    if (env.EXPECTED_HEAD && after.commit !== env.EXPECTED_HEAD) throw new Error('Head differs from triggering run')
    if (env.EXPECTED_BASE && report.before?.commit !== env.EXPECTED_BASE)
        throw new Error('Base differs from verified comparison')
    if (
        report.type === 'capture' &&
        reportPath.includes(`/${after.width}x${after.height}/`) === false &&
        after.width !== 393
    )
        throw new Error('Report path does not match capture profile')
    if (report.type === 'capture' && reportPath.includes(`/${after.width}x${after.height}/`) && after.width === 393)
        throw new Error('Default profile must use the canonical path')
    // Comparisons above always consume the exact PNG capture artifacts. Only
    // this public copy is rewritten to lossy, full-resolution WebP assets.
    const publicReport = JSON.parse(JSON.stringify(report))
    const publicAssets = new Map()
    const convertedAssets = new Map()
    const variableDimensions = report.type === 'journeys'
    function convertToPublicWebp(name, variable = variableDimensions) {
        const conversionKey = `${name}:${variable ? 'variable' : `${after.width}x${after.height}`}`
        if (convertedAssets.has(conversionKey)) return convertedAssets.get(conversionKey)
        let sharedConversion = assetConversions.get(conversionKey)
        if (!sharedConversion) {
            sharedConversion = (async () => {
                if (!name?.endsWith('.png')) throw new Error('Full screenshots must remain PNG until publication')
                const source = verifyAsset(assets, name, {
                    variableDimensions: variable,
                    width: after.width,
                    height: after.height,
                })
                const inputOptions = { limitInputPixels: variable ? 16_000_000 : after.width * after.height }
                const sourceMetadata = await sharp(source, inputOptions).metadata()
                const pipeline = sharp(source, inputOptions)
                if (!variable) pipeline.resize({ width: after.width, height: after.height, fit: 'fill' })
                const bytes = await pipeline
                    .webp({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 4 })
                    .toBuffer()
                const metadata = await sharp(bytes, inputOptions).metadata()
                const expectedWidth = variable ? sourceMetadata.width : after.width
                const expectedHeight = variable ? sourceMetadata.height : after.height
                if (metadata.width !== expectedWidth || metadata.height !== expectedHeight)
                    throw new Error('Invalid public WebP dimensions')
                const publicName = `${hash(bytes)}.webp`
                return { publicName, bytes }
            })()
            assetConversions.set(conversionKey, sharedConversion)
        }
        const conversion = (async () => {
            const { publicName, bytes } = await sharedConversion
            publicAssets.set(publicName, bytes)
            return publicName
        })()
        convertedAssets.set(conversionKey, conversion)
        return conversion
    }
    async function rewriteScreen(screen) {
        if (!screen?.image) return
        const publicName = await convertToPublicWebp(screen.image)
        screen.image = publicName
        // Schema compatibility: both fields intentionally resolve to the same
        // full-size asset so cards never select a reduced-size variant.
        screen.thumbnail = publicName
    }
    const rewrites = []
    for (const capture of publicReport.type === 'comparison'
        ? [publicReport.before, publicReport.after]
        : [publicReport])
        rewrites.push(...capture.screens.map((screen) => () => rewriteScreen(screen)))
    if (publicReport.type === 'comparison')
        for (const screen of publicReport.screens) {
            rewrites.push(
                () => rewriteScreen(screen.before),
                () => rewriteScreen(screen.after)
            )
            if (screen.diff) rewrites.push(async () => (screen.diff = await convertToPublicWebp(screen.diff, false)))
        }
    await mapBounded(rewrites, (rewrite) => rewrite(), 4)
    const options = { allowOverwrite: false }
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
        await mapBounded(
            [...publicAssets],
            async ([name, bytes]) => {
                const pathname = `assets/${name}`
                if (!knownAssets?.has(pathname)) {
                    let write = assetWrites.get(pathname)
                    if (!write) {
                        write = immutable(pathname, bytes, 'image/webp')
                        assetWrites.set(pathname, write)
                    }
                    await write
                    knownAssets?.add(pathname)
                }
                writeFileSync(join(offline, 'assets', name), bytes)
            },
            8
        )
        const json = JSON.stringify(publicReport)
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
            JSON.stringify(publicReport),
            'application/json'
        )
        const date = reportPath.slice(0, 10)
        await immutable(
            `entries/${reportPath.replaceAll('/', '_')}.json`,
            JSON.stringify({
                path: reportPath,
                date,
                label: report.type === 'journeys' ? `Nutcracker · ${report.commit.slice(0, 8)}` : reportPath.slice(11),
                locale: report.locale ?? 'en',
                localeLabel: localeInfo[report.locale ?? 'en']?.label ?? report.locale ?? 'English',
                source: report.type === 'journeys' ? 'nutcracker' : 'synthetic',
                ...(report.type === 'journeys' || report.type === 'capture'
                    ? { profile: `${after.width}x${after.height}` }
                    : {}),
                complete: report.complete,
                sequence: Number(env.DEV_SEQUENCE ?? 0),
                attempt: Number(env.RUN_ATTEMPT ?? 0),
                captureAttempt: Number(env.CAPTURE_ATTEMPT ?? 0),
                ...entryMetadata(publicReport, reportPath, env),
            }),
            'application/json'
        )
        if (updateSharedIndexes) await updateIndexes({ put, list, read })
        console.log(`${env.SCREEN_LIBRARY_PUBLIC_URL}/screens/${reportPath}/`)
        console.log(`Storage manifest: ${manifest.url}`)
        return { report: publicReport, manifest }
    } finally {
        rmSync(offline, { recursive: true, force: true })
    }
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain)
    await publishReport({
        inputDir: process.argv[2],
        reportPath: process.argv[3],
    })
