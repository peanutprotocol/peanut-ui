import { chromium, devices } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { release } from 'node:os'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { SCREENS } from '../../src/dev/screens/catalogue'
import { APP_LOCALES, type AppLocale } from '../../src/i18n/app/config'
import { answer, ADAPTER_VERSION } from './adapter'
import { hash, storeAsset, validateCapture, materializeCatalogue } from './core.mjs'
import { captureExitCode } from './capture-status.mjs'
import { localizedCaptureText } from './capture-copy.mjs'
import { isRemoteOptimizedImage, REMOTE_IMAGE_PLACEHOLDER } from './capture-images.mjs'
import { FIXTURE_BANNER_CANDIDATE_SELECTOR, hideFixtureBanners } from './capture-ui.mjs'

import { routePatterns, routePatternFor } from './routes.mjs'
import { inventory } from './inventory.mjs'

async function main() {
    const arg = (name: string, fallback = '') =>
        process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
    const source = resolve(arg('source', '.')),
        out = resolve(arg('out', 'e2e/__shots__/library')),
        localeArg = arg('locale', 'en')
    if (!APP_LOCALES.includes(localeArg as AppLocale)) throw new Error(`Unsupported capture locale: ${localeArg}`)
    const captureLocale = localeArg as AppLocale
    const captureText = localizedCaptureText(captureLocale, source)
    const target = new URL(arg('url', 'http://127.0.0.1:3080'))
    if (!['127.0.0.1', 'localhost'].includes(target.hostname))
        throw new Error('Capture only supports isolated local builds')
    type AssetOverlay = { path: string; file: string; source: string; before: string; after: string }
    const assetOverlays: AssetOverlay[] = arg('asset-overlays') ? JSON.parse(arg('asset-overlays')) : []
    const overlayBytes = new Map<string, Buffer>()
    for (const overlay of assetOverlays) {
        if (
            !/^\/[\w./-]+$/.test(overlay?.path ?? '') ||
            overlay.path.includes('..') ||
            !/^public\/[\w./-]+$/.test(overlay?.file ?? '') ||
            overlay.file.includes('..') ||
            !/^[a-f0-9]{64}$/.test(overlay?.before ?? '') ||
            !/^[a-f0-9]{64}$/.test(overlay?.after ?? '') ||
            !existsSync(overlay?.source ?? '')
        )
            throw new Error('Invalid capture asset overlay')
        const targetBytes = readFileSync(join(source, overlay.file))
        const sourceBytes = readFileSync(overlay.source)
        if (hash(targetBytes) !== overlay.before || hash(sourceBytes) !== overlay.after)
            throw new Error('Capture asset overlay identity mismatch')
        overlayBytes.set(overlay.path, sourceBytes)
    }
    // The browser sees one origin on both revisions, including location.origin
    // links and QR payloads. Every app request is fulfilled from the local build.
    const base = new URL('https://staging.peanut.me')
    const upstream = (url: URL) => new URL(url.pathname + url.search, target).href
    const git = (...args: string[]) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim()
    const commit = git('rev-parse', 'HEAD'),
        expected = arg('sha', commit)
    if (commit !== expected) throw new Error('Checkout does not match requested SHA')
    const buildResponse = await fetch(new URL('/screen-capture-build.json', target))
    const buildIdentity = await buildResponse.json()
    if (
        !buildResponse.ok ||
        buildIdentity.commit !== commit ||
        buildIdentity.publicBase !== 'https://staging.peanut.me'
    )
        throw new Error('Running server does not identify the requested build')
    const historical = arg('historical') === 'true'
    const assets = join(out, 'assets')
    mkdirSync(assets, { recursive: true })
    const walk = (p: string): string[] =>
        readdirSync(p, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)]
        )
    const identity = (paths: string[]) =>
        hash(
            paths
                .sort()
                .map((p) => `${p}\0${readFileSync(p)}`)
                .join('\0')
        )
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    let launchError: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            browser = await chromium.launch({
                headless: true,
                channel: 'chromium',
                timeout: 60000,
                ...(arg('executable') ? { executablePath: arg('executable') } : {}),
            })
            break
        } catch (error) {
            launchError = error
            if (attempt < 3) await new Promise((done) => setTimeout(done, attempt * 1000))
        }
    }
    if (!browser) throw launchError
    const contextOptions = {
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['Pixel 7'].userAgent,
        locale: captureLocale,
        timezoneId: 'UTC',
        colorScheme: 'light' as const,
        reducedMotion: 'reduce' as const,
        serviceWorkers: 'block' as const,
    }
    const currentRoutes = routePatterns(resolve('.')),
        targetRoutes = new Set(routePatterns(source))
    const surfaceList = join(source, 'src/dev/surfaces/list.ts')
    const knownSurfaces = existsSync(surfaceList) ? readFileSync(surfaceList, 'utf8') : ''
    const stillImages = new Map<string, Buffer>()
    const staticResponses = new Map<string, { status: number; headers: Record<string, string>; body: Buffer }>()
    const results: Record<string, unknown>[] = []
    const selected = arg('only').split(',').filter(Boolean)
    const requireFullCatalogue = arg('full-catalogue') === 'true'
    if (requireFullCatalogue && selected.length) throw new Error('Full catalogue capture cannot use --only')
    const environment = `${process.platform}-${process.arch}-${release()};node=${process.version};chromium=${browser.version()};dpr=1;locale=${captureLocale};browser=${captureLocale};UTC;light;reduced-motion`
    const harness = identity([
        ...walk('scripts/screens').filter((p) => !p.endsWith('.test.mjs')),
        ...walk('src/dev/screens'),
        ...walk('src/dev/surfaces'),
        'pnpm-lock.yaml',
    ])
    const fixtures = identity([
        ...walk('src/dev/fixtures'),
        'src/utils/demo-api.ts',
        'src/constants/demo-data.ts',
        'src/constants/residence.consts.ts',
    ])
    const manifest = () =>
        validateCapture({
            schema: 1,
            type: 'capture',
            commit,
            locale: captureLocale,
            contentCommit: git('rev-parse', 'HEAD:src/content'),
            publicBase: buildIdentity.publicBase,
            harness,
            fixtures,
            environment,
            adapter: ADAPTER_VERSION,
            capturedAt: new Date().toISOString(),
            reconstruction: historical,
            profile: `${captureLocale}-393x852`,
            width: 393,
            height: 852,
            screens: materializeCatalogue(SCREENS, results),
            inventory: inventory(source, SCREENS),
            adapterFiles: [
                ...(existsSync(join(source, '.screen-capture-adapter.json'))
                    ? JSON.parse(readFileSync(join(source, '.screen-capture-adapter.json'), 'utf8')).changed
                    : []),
                ...assetOverlays.map(({ file, before, after }) => ({ path: file, before, after })),
            ],
        })
    try {
        for (const screen of SCREENS) {
            const metadata = {
                id: screen.id,
                name: screen.name,
                flow: screen.flow,
                kind: screen.kind,
                order: screen.order,
                ...(screen.journey ? { journey: screen.journey } : {}),
            }
            const expectedText = screen.expectText ? captureText(screen.expectText) : undefined
            const clicks = screen.clicks.map(captureText)
            const clickTestIds = screen.clickTestIds ?? []
            const actions = screen.actions?.map((action) =>
                'click' in action ? { ...action, click: captureText(action.click) } : action
            )
            if (
                (screen.requiresSource && !existsSync(join(source, screen.requiresSource))) ||
                screen.exclusion ||
                screen.unavailable ||
                (screen.route.startsWith('/dev/surfaces') &&
                    !knownSurfaces.includes(new URL(screen.route, base).searchParams.get('s') ?? screen.id)) ||
                (selected.length && !selected.includes(screen.id)) ||
                (historical && screen.kind === 'component')
            ) {
                results.push({
                    ...metadata,
                    status: screen.exclusion ? 'excluded' : 'unavailable',
                    reason:
                        (screen.requiresSource && !existsSync(join(source, screen.requiresSource))
                            ? 'This revision has no compatible source for this screen state'
                            : undefined) ??
                        screen.exclusion ??
                        screen.unavailable ??
                        (screen.route.startsWith('/dev/surfaces') &&
                        !knownSurfaces.includes(new URL(screen.route, base).searchParams.get('s') ?? screen.id)
                            ? 'This revision has no compatible scenario harness for this component; no newer product code was copied'
                            : undefined) ??
                        (selected.length
                            ? 'Not selected in this diagnostic run'
                            : 'Historical revision has no isolated component harness; no modern components were copied'),
                })
                continue
            }
            const pattern = screen.routePattern ?? routePatternFor(screen.route.split('?')[0], currentRoutes)
            if (screen.kind === 'route' && pattern && !targetRoutes.has(pattern)) {
                results.push({
                    ...metadata,
                    status: 'absent',
                    reason: `App route ${pattern} does not exist in this revision`,
                })
                continue
            }
            const context = await browser.newContext(contextOptions)
            const page = await context.newPage()
            page.setDefaultTimeout(15000)
            const unknown = new Set<string>()
            const transportFailures = new Set<string>()
            try {
                await page.addInitScript('window.__name = (target) => target')
                await page.clock.setFixedTime(new Date('2026-09-01T12:00:00Z'))
                await page.addInitScript((locale) => {
                    ;(window as unknown as { __screenCapture: boolean }).__screenCapture = true
                    // A constant draw is independent of unrelated startup call order.
                    Math.random = () => 0.42
                    document.addEventListener(
                        'play',
                        (event) => {
                            const video = event.target
                            if (video instanceof HTMLVideoElement && !video.srcObject) video.pause()
                        },
                        true
                    )
                    sessionStorage.removeItem('showNoMoreJailModal')
                    localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00Z')
                    localStorage.setItem(
                        'demo-user:user-preferences',
                        JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
                    )
                    sessionStorage.setItem('user_geo_country_code', 'DE')
                    sessionStorage.setItem('user_geo_country_code_timestamp', String(Date.now()))
                    document.cookie = 'jwt-token=fixture; path=/'
                    document.cookie = `app-locale=${locale}; path=/`
                    document.cookie = `NEXT_LOCALE=${locale}; path=/`
                }, captureLocale)
                if (screen.camera)
                    await page.addInitScript((mode) => {
                        // A stationary synthetic camera frame keeps app-owned scanner UI
                        // repeatable without opening a real camera or recording anything.
                        navigator.mediaDevices.getUserMedia = async () => {
                            if (mode === 'denied') throw new DOMException('Synthetic camera denial', 'NotAllowedError')
                            const canvas = document.createElement('canvas')
                            canvas.width = 640
                            canvas.height = 480
                            const ctx = canvas.getContext('2d')!
                            ctx.fillStyle = '#222222'
                            ctx.fillRect(0, 0, 640, 480)
                            return canvas.captureStream(1)
                        }
                        navigator.mediaDevices.enumerateDevices = async () => [
                            {
                                deviceId: 'synthetic-camera',
                                groupId: 'synthetic',
                                kind: 'videoinput',
                                label: 'Synthetic camera',
                                toJSON() {
                                    return {}
                                },
                            } as MediaDeviceInfo,
                        ]
                    }, screen.camera)
                await page.route('**/*', async (route) => {
                    try {
                        const request = route.request(),
                            url = new URL(request.url())
                        if (url.origin === base.origin && url.pathname === '/crisp-proxy')
                            return route.fulfill({
                                status: 200,
                                contentType: 'text/html',
                                body: '<!doctype html><script>parent.postMessage({type:"CRISP_FAILED"}, location.origin)</script>',
                            })
                        const media = url.origin === base.origin ? overlayBytes.get(url.pathname) : undefined
                        if (media && request.method() === 'GET') {
                            const range = request.headers().range
                            const match = range?.match(/^bytes=(\d+)-(\d*)$/)
                            if (!match) {
                                return route.fulfill({
                                    status: 200,
                                    headers: {
                                        'accept-ranges': 'bytes',
                                        'content-length': String(media.length),
                                        'content-type': 'video/quicktime',
                                    },
                                    body: media,
                                })
                            }
                            const start = Number(match[1])
                            const end = Math.min(match[2] ? Number(match[2]) : media.length - 1, media.length - 1)
                            if (start > end || start >= media.length)
                                return route.fulfill({
                                    status: 416,
                                    headers: { 'content-range': `bytes */${media.length}` },
                                })
                            return route.fulfill({
                                status: 206,
                                headers: {
                                    'accept-ranges': 'bytes',
                                    'content-length': String(end - start + 1),
                                    'content-range': `bytes ${start}-${end}/${media.length}`,
                                    'content-type': 'video/quicktime',
                                },
                                body: media.subarray(start, end + 1),
                            })
                        }
                        // All API transports, including local same-origin test API, use synthetic answers.
                        if (
                            url.hostname === 'api.peanut.me' ||
                            url.hostname === 'api.staging.peanut.me' ||
                            url.pathname.startsWith('/screen-capture-api/')
                        ) {
                            const path = url.pathname.replace(/^\/screen-capture-api/, '') + url.search
                            try {
                                const response = await answer(
                                    screen.fixture,
                                    path,
                                    request.method(),
                                    request.postData() ?? undefined
                                )
                                await route.fulfill({
                                    status: response.status,
                                    contentType: 'application/json',
                                    body: await response.text(),
                                })
                            } catch {
                                unknown.add(`${request.method()} ${url.pathname}`)
                                await route.fulfill({
                                    status: 501,
                                    contentType: 'application/json',
                                    body: '{"error":"Unmapped synthetic API"}',
                                })
                            }
                            return
                        }
                        if (isRemoteOptimizedImage(url.href, base.origin)) {
                            // Next's same-origin optimizer otherwise reaches the public internet on behalf of
                            // remote image URLs. Keep capture independent of third-party CDN latency/failures.
                            return route.fulfill({
                                status: 200,
                                contentType: 'image/svg+xml',
                                headers: { 'cache-control': 'public, max-age=31536000, immutable' },
                                body: REMOTE_IMAGE_PLACEHOLDER,
                            })
                        }
                        if (
                            url.origin === base.origin &&
                            /\.(gif|webp)$/.test(
                                url.pathname === '/_next/image'
                                    ? new URL(url.searchParams.get('url') ?? '/', base).pathname
                                    : url.pathname
                            )
                        ) {
                            // Freeze animated image assets at frame zero; CSS animation rules do not stop them.
                            let bytes = stillImages.get(url.href)
                            if (!bytes) {
                                const response = await route.fetch({
                                    url: upstream(url),
                                    maxRedirects: 0,
                                    maxRetries: 2,
                                })
                                if (!response.ok()) return route.fulfill({ response })
                                bytes = await sharp(await response.body(), { animated: false })
                                    .png()
                                    .toBuffer()
                                stillImages.set(url.href, bytes)
                            }
                            return route.fulfill({ status: 200, contentType: 'image/png', body: bytes })
                        }
                        if (url.origin === base.origin) {
                            const cacheable =
                                request.method() === 'GET' &&
                                url.pathname.startsWith('/_next/static/') &&
                                !request.headers()['range']
                            const cached = cacheable ? staticResponses.get(url.href) : undefined
                            if (cached) return route.fulfill(cached)
                            const response = await route.fetch({ url: upstream(url), maxRedirects: 0, maxRetries: 2 })
                            if (cacheable && response.ok()) {
                                const headers = { ...response.headers() }
                                delete headers['content-encoding']
                                delete headers['content-length']
                                delete headers['transfer-encoding']
                                const entry = { status: response.status(), headers, body: await response.body() }
                                staticResponses.set(url.href, entry)
                                return route.fulfill(entry)
                            }
                            return route.fulfill({ response })
                        }
                        return route.abort()
                    } catch {
                        if (!page.isClosed()) transportFailures.add(new URL(route.request().url()).pathname)
                        await route.abort().catch(() => undefined)
                    }
                })
                const url = new URL(screen.route, base)
                if (!historical) url.searchParams.set('__fixture', screen.fixture)
                if (screen.sessionStorage)
                    await page.addInitScript((values) => {
                        for (const [key, value] of Object.entries(values)) sessionStorage.setItem(key, value)
                    }, screen.sessionStorage)
                if (screen.storage)
                    await page.addInitScript((values) => {
                        for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
                    }, screen.storage)
                const entry = new URL(screen.entryRoute ?? screen.route, base)
                if (!historical) entry.searchParams.set('__fixture', screen.fixture)
                const response = await page.goto(entry.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
                if (!response || ![screen.expectedHttpStatus].flat().includes(response.status()))
                    throw new Error(
                        `HTTP ${response?.status()} for requested route (expected ${screen.expectedHttpStatus})`
                    )
                if (expectedText)
                    await page
                        .getByText(expectedText, { exact: false })
                        .first()
                        .waitFor({ state: 'visible', timeout: 15000 })
                for (const label of clicks)
                    await page.getByText(label, { exact: false }).first().click({ timeout: 10000 })
                for (const testId of clickTestIds) {
                    await page.getByTestId(testId).click({ timeout: 10000 })
                    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 })
                }
                for (const action of actions ?? []) {
                    if ('click' in action) await page.getByText(action.click, { exact: false }).first().click()
                    else await page.locator(action.fill.selector).fill(action.fill.value)
                }
                if (screen.entryRoute)
                    await page.waitForURL((destination) => destination.pathname === url.pathname, { timeout: 30000 })
                await page.waitForLoadState('networkidle', { timeout: 15000 })
                if (screen.event) {
                    await page.waitForFunction(() => document.body.innerText.trim().length > 60)
                    await page.evaluate(
                        (event) => window.dispatchEvent(new CustomEvent(event, { detail: { retryAfterSec: 300 } })),
                        screen.event
                    )
                    await page.getByRole('dialog').first().waitFor({ state: 'visible', timeout: 10000 })
                }
                if (screen.toBottom) await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
                // Playwright visibility ignores opacity. Let Headless UI finish
                // opening dialogs before disabling CSS transitions for capture.
                await page.waitForFunction(() =>
                    [...document.querySelectorAll('[role="dialog"]')].every((dialog) =>
                        [dialog, ...dialog.querySelectorAll('[data-headlessui-state]')].every((element) => {
                            if (!element.getBoundingClientRect().width) return true
                            return Number(getComputedStyle(element).opacity) === 1
                        })
                    )
                )
                await page.addStyleTag({
                    content:
                        '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important} [data-testid="fixture-banner"],a[href*="__fixture=off"]{display:none!important}',
                })
                await page.locator(FIXTURE_BANNER_CANDIDATE_SELECTOR).evaluateAll(hideFixtureBanners)
                await page.evaluate(() => document.fonts.ready)
                if (screen.videoFrame !== undefined) await page.locator('video').first().waitFor({ state: 'attached' })
                await page.waitForFunction(() =>
                    [...document.querySelectorAll('video')].every((video) => video.srcObject || video.readyState >= 2)
                )
                await page.evaluate(async () => {
                    for (const video of document.querySelectorAll('video')) {
                        if (video.srcObject) continue // stationary synthetic camera stream
                        video.pause()
                        const targetTime = Math.min(0.5, video.duration / 2)
                        if (Math.abs(video.currentTime - targetTime) < 0.001) continue
                        await new Promise<void>((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error('Video frame unavailable')), 10000)
                            const complete = () => {
                                clearTimeout(timeout)
                                resolve()
                            }
                            if (video.requestVideoFrameCallback) {
                                const presented: VideoFrameRequestCallback = (_now, metadata) => {
                                    if (Math.abs(metadata.mediaTime - targetTime) < 0.04) complete()
                                    else video.requestVideoFrameCallback(presented)
                                }
                                video.requestVideoFrameCallback(presented)
                            } else video.addEventListener('seeked', complete, { once: true })
                            video.currentTime = targetTime
                        })
                        video.pause()
                    }
                })
                await page.waitForFunction(
                    (expectsLoading: boolean) => {
                        const visible = (e: Element) => {
                            const r = e.getBoundingClientRect()
                            return (
                                r.width > 0 &&
                                r.height > 0 &&
                                r.bottom > 0 &&
                                r.top < innerHeight &&
                                r.right > 0 &&
                                r.left < innerWidth
                            )
                        }
                        return (
                            (expectsLoading ||
                                ![...document.querySelectorAll('.animate-spin,.animate-pulse')].some(visible)) &&
                            [...document.images].filter(visible).every((i) => i.complete && i.naturalWidth > 0) &&
                            document.body.innerText.trim().length > 15
                        )
                    },
                    screen.expectsLoading ?? false,
                    { timeout: 15000 }
                )
                if (new URL(page.url()).pathname !== url.pathname)
                    throw new Error(`Expected ${url.pathname}, reached ${new URL(page.url()).pathname}`)
                if (/Not capturable|Unknown surface:|Application error:/.test(await page.locator('body').innerText()))
                    throw new Error('Harness placeholder or application error')
                if (transportFailures.size)
                    throw new Error(`Local build transport failed: ${[...transportFailures].join(', ')}`)
                if (unknown.size) throw new Error(`Missing synthetic responses: ${[...unknown].join(', ')}`)
                let previous = await page.screenshot({
                    animations: 'disabled',
                    caret: 'hide',
                    scale: 'css',
                    timeout: 30000,
                })
                let stable = false
                let identical = 0
                for (let i = 0; i < 40; i++) {
                    await page.waitForTimeout(250)
                    const next = await page.screenshot({
                        animations: 'disabled',
                        caret: 'hide',
                        scale: 'css',
                        timeout: 30000,
                    })
                    identical = hash(previous) === hash(next) ? identical + 1 : 0
                    if (identical >= 4) {
                        stable = true
                        break
                    }
                    previous = next
                }
                if (!stable) throw new Error('Screen did not stabilize')
                if (expectedText && !(await page.getByText(expectedText, { exact: false }).first().isVisible()))
                    throw new Error('Expected screen content disappeared before capture')
                if (transportFailures.size)
                    throw new Error(`Local build transport failed: ${[...transportFailures].join(', ')}`)
                if (unknown.size) throw new Error(`Missing synthetic responses: ${[...unknown].join(', ')}`)
                const image = storeAsset(assets, previous)
                // Keep the exact PNG as the only CI capture source. The trusted
                // publisher converts it to a full-resolution WebP after diffing.
                results.push({ ...metadata, status: 'captured', image, thumbnail: image })
                console.log(`CAPTURED ${screen.id}`)
            } catch (e) {
                mkdirSync(join(out, 'diagnostics'), { recursive: true })
                writeFileSync(
                    join(out, 'diagnostics', `${screen.id}.txt`),
                    await page
                        .locator('body')
                        .innerText()
                        .catch(() => 'Page closed')
                )
                await page.screenshot({ path: join(out, 'diagnostics', `${screen.id}.png`) }).catch(() => undefined)
                const reason = String(e instanceof Error ? e.message : e).slice(0, 950)
                // Expected historical gaps are classified before this harness
                // runs. An exception here is a real runtime failure on either
                // revision and must keep the capture job red.
                results.push({ ...metadata, status: 'failed', reason })
                console.log(`FAILED ${screen.id}: ${reason.split('\n')[0]}`)
            } finally {
                await context.close()
            }
            writeFileSync(join(out, 'capture.json'), JSON.stringify(manifest(), null, 2))
        }
        const report = manifest()
        writeFileSync(join(out, 'capture.json'), JSON.stringify(report, null, 2))
        console.log(
            JSON.stringify({
                commit,
                complete: report.complete,
                counts: results.reduce((a: Record<string, number>, r) => {
                    const k = String(r.status)
                    a[k] = (a[k] ?? 0) + 1
                    return a
                }, {}),
            })
        )
        if (requireFullCatalogue && !report.complete) {
            console.error('Full catalogue capture is incomplete; refusing to publish this baseline')
        }
        // Incomplete captures are valid gallery reports: the manifest records
        // expected gaps and the publisher can still expose them. A caught
        // Runtime failures on either revision remain red capture jobs.
        process.exitCode = Math.max(captureExitCode(results), requireFullCatalogue && !report.complete ? 1 : 0)
    } finally {
        await browser.close()
    }
}
void main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
