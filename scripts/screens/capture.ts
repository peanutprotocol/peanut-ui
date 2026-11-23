import { chromium, devices, expect, type Request } from '@playwright/test'
import { hasInvalidNumericUi } from './numeric-ui.mjs'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { stripVTControlCharacters } from 'node:util'
import { release } from 'node:os'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { SCREENS } from '../../src/dev/screens/catalogue'
import { APP_LOCALES, type AppLocale } from '../../src/i18n/app/config'
import { answer, ADAPTER_VERSION } from './adapter'
import { answerRpc, isChainRpc, isRhinoTokenConfigs } from './rpc'
import { freezeDate } from './freeze-date.mjs'
import { FLAG_READERS, FLAG_RECORDER_MARKER, installFlagRecorder } from './flag-recorder.mjs'
import { hash, storeAsset, validateCapture } from './core.mjs'
import { canonicalScope, scopeCapture } from './capture-scope.mjs'
import { fixtureIdentityFiles, fixtureRootFiles } from './capture-impact.mjs'
import { harnessIdentityFiles, fileIdentity } from './capture-identity.mjs'
import { captureExitCode } from './capture-status.mjs'
import { captureProfile } from './capture-profiles.mjs'
import { installCaptureSafeArea } from './capture-safe-area.mjs'
import { localizedCaptureText } from './capture-copy.mjs'
import { COPY_EVIDENCE_SCRIPT, COPY_RECORDER_MARKER, installCopyRecorder } from './copy-recorder.mjs'
import { shownCopyKeys } from './copy-coverage.mjs'
import { remoteOptimizedCaptureImage } from './capture-images.mjs'
import {
    CAPTURE_STATIC_CSS,
    FIXTURE_BANNER_CANDIDATE_SELECTOR,
    finishOverlayAnimations,
    hideFixtureBanners,
} from './capture-ui.mjs'

import { routePatterns, routePatternFor } from './routes.mjs'
import { inventory } from './inventory.mjs'
import { waitForFixtureReady, revealCheckpoint } from './fixture-readiness.mjs'

class ScreenUnavailable extends Error {}

async function main() {
    const arg = (name: string, fallback = '') =>
        process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
    const source = resolve(arg('source', '.')),
        out = resolve(arg('out', 'e2e/__shots__/library')),
        localeArg = arg('locale', 'en')
    if (!APP_LOCALES.includes(localeArg as AppLocale)) throw new Error(`Unsupported capture locale: ${localeArg}`)
    const captureLocale = localeArg as AppLocale
    const profile = captureProfile(arg('profile', '393x852'))
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
    const readBuildIdentity = async () => {
        const response = await fetch(new URL('/screen-capture-build.json', target), {
            signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) throw new Error(`Capture server identity returned HTTP ${response.status}`)
        const identity = await response.json()
        if (identity.commit !== commit || identity.publicBase !== 'https://staging.peanut.me')
            throw new Error('Running server does not identify the requested build')
        return identity
    }
    const buildIdentity = await readBuildIdentity()
    const verifyLiveBuild = async () => {
        if ((await readBuildIdentity()).nonce !== buildIdentity.nonce)
            throw new Error('Capture server build changed during capture')
    }
    const historical = arg('historical') === 'true'
    const intlCore = join(source, 'src/i18n/app/IntlCore.tsx')
    const copyRecording =
        existsSync(intlCore) && readFileSync(intlCore, 'utf8').includes(COPY_RECORDER_MARKER)
            ? 'recorded'
            : 'unavailable'
    const flagsSettable = FLAG_READERS.every(({ path }) => {
        const file = join(source, path)
        return existsSync(file) && readFileSync(file, 'utf8').includes(FLAG_RECORDER_MARKER)
    })
    const assets = join(out, 'assets')
    mkdirSync(assets, { recursive: true })
    const walk = (p: string): string[] =>
        readdirSync(p, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)]
        )
    const identity = fileIdentity
    const browserProfile = devices[profile.browserProfile]
    if (!browserProfile) throw new Error(`Unsupported browser profile: ${profile.browserProfile}`)
    const contextOptions = {
        viewport: { width: profile.width, height: profile.height },
        screen: { width: profile.width, height: profile.height },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        userAgent: browserProfile.userAgent,
        locale: captureLocale,
        timezoneId: 'UTC',
        colorScheme: 'light' as const,
        reducedMotion: 'reduce' as const,
        serviceWorkers: 'block' as const,
    }
    const currentRoutes = routePatterns(resolve('.')),
        targetRoutes = new Set(routePatterns(source))
    // Membership comes from the revision being photographed. Shared states use the same
    // harness recipe on both sides; a base-only state keeps its own definition.
    const cataloguePath = join(source, 'src/dev/screens/catalogue.ts')
    const headById = new Map(SCREENS.map((screen) => [screen.id, screen]))
    const targetScreens: typeof SCREENS =
        source !== resolve('.') && existsSync(cataloguePath)
            ? JSON.parse(
                  execFileSync(
                      process.execPath,
                      [
                          '--import',
                          createRequire(import.meta.url).resolve('tsx'),
                          '-e',
                          "process.stdout.write(JSON.stringify(require('./src/dev/screens/catalogue.ts').SCREENS))",
                      ],
                      { cwd: source, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 }
                  )
              )
            : SCREENS
    const catalogue = targetScreens.map((screen) => headById.get(screen.id) ?? screen)
    const stillImages = new Map<string, Buffer>()
    const staticResponses = new Map<string, { status: number; headers: Record<string, string>; body: Buffer }>()
    const results: Record<string, unknown>[] = []
    const selected = arg('only').split(',').filter(Boolean)
    const requireFullCatalogue = arg('full-catalogue') === 'true'
    const targetIds = new Set(catalogue.map((screen) => screen.id))
    // A targeted pair can explicitly name a state added since its base.
    for (const id of selected) {
        if (targetIds.has(id)) continue
        const screen = headById.get(id)
        if (!screen) throw new Error(`Unknown selected screen: ${id}`)
        catalogue.push(screen)
    }
    const scope =
        arg('scope') === 'targeted'
            ? canonicalScope({ mode: 'targeted', screenIds: selected }, new Set(catalogue.map((screen) => screen.id)))
            : undefined
    if (requireFullCatalogue && selected.length) throw new Error('Full catalogue capture cannot use --only')
    const harness = identity(harnessIdentityFiles())
    const fixtures = identity(fixtureIdentityFiles(fixtureRootFiles(walk('src/dev/fixtures'))))
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
    const environment = `${process.platform}-${process.arch}-${release()};node=${process.version};chromium=${browser.version()};dpr=1;locale=${captureLocale};device=${profile.device.platform};browser=${profile.browserProfile};safe-area=${Object.values(profile.device.safeArea).join(',')};UTC;light;reduced-motion`
    try {
        for (const screen of catalogue) {
            const metadata = {
                id: screen.id,
                name: screen.name,
                flow: screen.flow,
                kind: screen.kind,
                defaultScreen: screen.defaultScreen,
                order: screen.order,
                ...(screen.journey ? { journey: screen.journey } : {}),
            }
            if (!targetIds.has(screen.id)) {
                results.push({
                    ...metadata,
                    status: 'absent',
                    reason: 'State is absent from this revision’s catalogue',
                })
                continue
            }
            const expectedText = screen.expectText ? captureText(screen.expectText) : undefined
            const clicks = screen.clicks?.map(captureText) ?? []
            const clickTestIds = screen.clickTestIds ?? []
            const actions = screen.actions?.map((action) =>
                'click' in action
                    ? { click: captureText(action.click) }
                    : 'tap' in action
                      ? { tap: captureText(action.tap) }
                      : action
            )
            if (
                (screen.requiresSource && !existsSync(join(source, screen.requiresSource))) ||
                screen.exclusion ||
                screen.unavailable ||
                (selected.length && !selected.includes(screen.id)) ||
                (historical && screen.kind === 'component') ||
                (screen.flags && !flagsSettable)
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
                        (screen.flags && !flagsSettable
                            ? 'This revision cannot set PostHog flags in a capture'
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
            const inFlight = new Map<Request, string>()
            page.on('request', (request) => inFlight.set(request, `${request.method()} ${request.url()}`))
            page.on('requestfinished', (request) => inFlight.delete(request))
            page.on('requestfailed', (request) => inFlight.delete(request))
            const url = new URL(screen.route, base)
            const redirected = () => {
                const actual = new URL(page.url())
                if (actual.protocol === 'about:') return
                if (
                    actual.origin !== url.origin ||
                    actual.pathname !== url.pathname ||
                    (url.searchParams.has('s') && actual.searchParams.get('s') !== url.searchParams.get('s'))
                ) {
                    const surface = actual.searchParams.get('s')
                    return `Redirected to ${actual.origin === url.origin ? '' : actual.origin}${actual.pathname}${surface ? '?s=' + encodeURIComponent(surface) : ''} (expected ${screen.route})`
                }
                return undefined
            }
            const pageErrors = new Set<string>()
            page.on('pageerror', (error) => pageErrors.add(error.message))
            let crashed = false
            page.on('crash', () => {
                crashed = true
            })
            let transportError: unknown
            let step = 'open route'
            try {
                await page.addInitScript('window.__name = (target) => target')
                await page.addInitScript(installCaptureSafeArea, profile.device)
                if (copyRecording === 'recorded') await page.addInitScript(installCopyRecorder)
                // Freeze Date only: Playwright's clock also replaces the page's timers, which held React
                // Query's update delivery for seconds and let a screen settle after it was captured.
                await page.addInitScript(freezeDate, Date.parse('2026-09-01T12:00:00Z'))
                if (flagsSettable) await page.addInitScript(installFlagRecorder, screen.flags ?? {})
                await page.addInitScript(
                    ({ locale, geoCountry }) => {
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
                        sessionStorage.setItem('user_geo_country_code', geoCountry)
                        sessionStorage.setItem('user_geo_country_code_timestamp', String(Date.now()))
                        document.cookie = 'jwt-token=fixture; path=/'
                        document.cookie = `app-locale=${locale}; path=/`
                        document.cookie = `NEXT_LOCALE=${locale}; path=/`
                    },
                    { locale: captureLocale, geoCountry: screen.geoCountry ?? 'DE' }
                )
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
                        if (screen.geoCountry && url.pathname.endsWith('/api/geo-country')) {
                            return await route.fulfill({
                                json: { country: screen.geoCountry },
                                headers: { 'access-control-allow-origin': '*' },
                            })
                        }
                        if (url.origin === base.origin && url.pathname === '/crisp-proxy')
                            return await route.fulfill({
                                status: 200,
                                contentType: 'text/html',
                                body: '<!doctype html><script>parent.postMessage({type:"CRISP_FAILED"}, location.origin)</script>',
                            })
                        const media = url.origin === base.origin ? overlayBytes.get(url.pathname) : undefined
                        if (media && request.method() === 'GET') {
                            const range = request.headers().range
                            const match = range?.match(/^bytes=(\d+)-(\d*)$/)
                            if (!match) {
                                return await route.fulfill({
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
                                return await route.fulfill({
                                    status: 416,
                                    headers: { 'content-range': `bytes */${media.length}` },
                                })
                            return await route.fulfill({
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
                        if (isRhinoTokenConfigs(url.href))
                            return await route.fulfill({
                                status: 200,
                                headers: { 'access-control-allow-origin': '*' },
                                contentType: 'application/json',
                                body: '{}',
                            })
                        if (isChainRpc(url.href)) {
                            const cors = {
                                'access-control-allow-origin': '*',
                                'access-control-allow-headers': '*',
                                'access-control-allow-methods': 'POST, OPTIONS',
                            }
                            if (request.method() === 'OPTIONS')
                                return await route.fulfill({ status: 204, headers: cors })
                            const rpc = answerRpc(url.href, screen.fixture, request.postData() ?? '')
                            for (const call of rpc.unmapped) unknown.add(call)
                            return await route.fulfill({
                                status: 200,
                                headers: cors,
                                contentType: 'application/json',
                                body: rpc.body,
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
                                    ...(response.body === null || request.method() === 'HEAD'
                                        ? {}
                                        : {
                                              contentType: response.headers.get('content-type') ?? 'application/json',
                                              body: await response.text(),
                                          }),
                                })
                            } catch (error) {
                                if (
                                    !(
                                        error instanceof Error &&
                                        /^(Unmapped capture API:|Unknown fixture )/.test(error.message)
                                    )
                                )
                                    transportError = error
                                unknown.add(`${request.method()} ${url.pathname}`)
                                await route.fulfill({
                                    status: 501,
                                    ...(request.method() === 'HEAD'
                                        ? {}
                                        : {
                                              contentType: 'application/json',
                                              body: '{"error":"Unmapped synthetic API"}',
                                          }),
                                })
                            }
                            return
                        }
                        const captureImage = remoteOptimizedCaptureImage(url.href, base.origin)
                        if (captureImage) {
                            // Next's same-origin optimizer otherwise reaches the public internet on behalf of
                            // remote image URLs. Keep capture independent of third-party CDN latency/failures.
                            return await route.fulfill({
                                status: 200,
                                headers: { 'cache-control': 'public, max-age=31536000, immutable' },
                                ...captureImage,
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
                                if (!response.ok()) return await route.fulfill({ response })
                                bytes = await sharp(await response.body(), { animated: false })
                                    .png()
                                    .toBuffer()
                                stillImages.set(url.href, bytes)
                            }
                            return await route.fulfill({ status: 200, contentType: 'image/png', body: bytes })
                        }
                        // The receipt pdf route reads the entry server side, past the synthetic API, so a
                        // fixture never resolves there; the request-pot kind held networkidle open for good.
                        if (url.origin === base.origin && /^\/receipt\/[^/]+\/pdf$/.test(url.pathname))
                            return await route.fulfill({
                                status: 404,
                                headers: { 'cache-control': 'no-store' },
                                body: '',
                            })
                        if (url.origin === base.origin) {
                            const cacheable =
                                request.method() === 'GET' &&
                                url.pathname.startsWith('/_next/static/') &&
                                !request.headers()['range']
                            const cached = cacheable ? staticResponses.get(url.href) : undefined
                            if (cached) return await route.fulfill(cached)
                            const response = await route.fetch({ url: upstream(url), maxRedirects: 0, maxRetries: 2 })
                            if (cacheable && response.ok()) {
                                const headers = { ...response.headers() }
                                delete headers['content-encoding']
                                delete headers['content-length']
                                delete headers['transfer-encoding']
                                const entry = { status: response.status(), headers, body: await response.body() }
                                staticResponses.set(url.href, entry)
                                return await route.fulfill(entry)
                            }
                            return await route.fulfill({ response })
                        }
                        return await route.abort()
                    } catch {
                        if (!page.isClosed()) transportFailures.add(new URL(route.request().url()).pathname)
                        await route.abort().catch(() => undefined)
                    }
                })
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
                if (!response || ![screen.expectedHttpStatus ?? 200].flat().includes(response.status()))
                    throw new ScreenUnavailable(
                        `HTTP ${response?.status()} for requested route (expected ${screen.expectedHttpStatus ?? 200})`
                    )
                step = 'wait for expected content'
                if (expectedText)
                    await page
                        .getByText(expectedText, { exact: false })
                        .first()
                        .waitFor({ state: 'visible', timeout: 15000 })
                step = 'click declared controls'
                for (const label of clicks)
                    await page.getByText(label, { exact: false }).first().click({ timeout: 10000 })
                for (const testId of clickTestIds) await page.getByTestId(testId).click({ timeout: 10000 })
                for (const action of actions ?? []) {
                    step = 'fill' in action ? `fill ${action.fill.selector}` : `activate ${Object.values(action)[0]}`
                    if ('click' in action) await page.getByText(action.click, { exact: false }).first().click()
                    else if ('clickSelector' in action) await page.locator(action.clickSelector).first().click()
                    else if ('reveal' in action) {
                        step = `reveal ${action.reveal}`
                        await revealCheckpoint(page, action.reveal)
                    } else if ('tapSelector' in action) await page.locator(action.tapSelector).tap()
                    else if ('tap' in action) await page.getByText(action.tap, { exact: true }).tap()
                    else {
                        await page.locator(action.fill.selector).fill(action.fill.value)
                        // Pause like a person before the next tap. The app writes a typed value to the
                        // URL after a short throttle (nuqs, 50 ms), and in Next.js a URL write that lands
                        // during a navigation discards it: an instant Continue went nowhere (p64, 5 of 40 local
                        // runs). An in-page timer fires after the app's earlier one, whatever the CPU load.
                        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 250)))
                    }
                }
                step = 'wait for destination route'
                if (screen.entryRoute)
                    await page.waitForURL((destination) => destination.pathname === url.pathname, { timeout: 30000 })
                step = 'wait for network idle'
                await page.waitForLoadState('networkidle', { timeout: 15000 }).catch((error: Error) => {
                    // a bare timeout names neither the request that never settled nor an unmapped API call
                    throw new ScreenUnavailable(
                        `${error.message}\nIn flight: ${[...inFlight.values()].join(', ') || 'none'}\nUnmapped: ${[...unknown].join(', ') || 'none'}`
                    )
                })
                step = `wait for ${screen.waitFor ?? screen.expectSelector ?? 'screen'}`
                await waitForFixtureReady(page, screen.waitFor)
                if (screen.expectSelector)
                    await expect(page.locator(screen.expectSelector).first()).toBeInViewport({ ratio: 0.5 })
                if (screen.event) {
                    await page.waitForFunction(() => document.body.innerText.trim().length > 60)
                    await page.evaluate(
                        (event) => window.dispatchEvent(new CustomEvent(event, { detail: { retryAfterSec: 300 } })),
                        screen.event
                    )
                    await page.getByRole('dialog').first().waitFor({ state: 'visible', timeout: 10000 })
                }
                if (screen.toBottom) await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
                step = 'wait for open overlays'
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
                await page.evaluate(() => document.fonts.ready)
                await page.evaluate(finishOverlayAnimations)
                await page.addStyleTag({ content: CAPTURE_STATIC_CSS })
                await page.locator(FIXTURE_BANNER_CANDIDATE_SELECTOR).evaluateAll(hideFixtureBanners)
                await page.evaluate(() => document.fonts.ready)
                step = 'wait for video frame'
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
                step = 'wait for visible images and loading indicators'
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
                            (Boolean(document.body.innerText.trim()) ||
                                [...document.querySelectorAll('img,svg,video,canvas,input,button')].some(visible))
                        )
                    },
                    screen.expectsLoading ?? false,
                    { timeout: 15000 }
                )
                step = 'wait for Lottie'
                // A Lottie (sign-up hero or mascot) shows frame 0 until it loads, then jumps to its reduced-motion still.
                await page.waitForFunction(() => !document.querySelector('[data-lottie-ready="false"]'), undefined, {
                    timeout: 15000,
                })
                if (redirected()) throw new ScreenUnavailable(redirected())
                if (/Not capturable|Unknown surface:|Application error:/.test(await page.locator('body').innerText()))
                    throw new ScreenUnavailable(
                        (await page.evaluate(() =>
                            document
                                .querySelector('[data-capture-unavailable]')
                                ?.getAttribute('data-capture-unavailable')
                        )) ?? 'Harness placeholder or application error'
                    )
                if (transportFailures.size)
                    throw new ScreenUnavailable(`Local build transport failed: ${[...transportFailures].join(', ')}`)
                if (unknown.size) throw new ScreenUnavailable(`Missing synthetic responses: ${[...unknown].join(', ')}`)
                // Applies to every registered screen/state and requested locale,
                // including controls whose value does not appear in innerText.
                const numericSnapshot = await page.evaluate(() => ({
                    text: document.body.innerText,
                    inputs: [...document.querySelectorAll('input')].map((input) => input.value),
                    sliderAttributes: [...document.querySelectorAll('[role="slider"]')].flatMap((slider) =>
                        ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext'].map(
                            (name) => slider.getAttribute(name) ?? ''
                        )
                    ),
                }))
                if (hasInvalidNumericUi(numericSnapshot))
                    throw new ScreenUnavailable('Invalid numeric UI in captured state')
                step = 'wait for stable pixels'
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
                if (!stable) throw new ScreenUnavailable('Screen did not stabilize')
                if (expectedText && !(await page.getByText(expectedText, { exact: false }).first().isVisible()))
                    throw new ScreenUnavailable('Expected screen content disappeared before capture')
                if (screen.expectSelector)
                    await expect(page.locator(screen.expectSelector).first()).toBeInViewport({ ratio: 0.5 })
                if (transportFailures.size)
                    throw new ScreenUnavailable(`Local build transport failed: ${[...transportFailures].join(', ')}`)
                if (unknown.size) throw new ScreenUnavailable(`Missing synthetic responses: ${[...unknown].join(', ')}`)
                const copy =
                    copyRecording === 'recorded' ? shownCopyKeys(await page.evaluate(COPY_EVIDENCE_SCRIPT)) : undefined
                if (screen.flags) {
                    const read = await page.evaluate(
                        () =>
                            (window as unknown as { __screenCaptureFlagReads: Record<string, unknown> })
                                .__screenCaptureFlagReads
                    )
                    for (const [flag, value] of Object.entries(screen.flags))
                        if (!(flag in read))
                            throw new ScreenUnavailable(
                                `This state never reads ${flag}, so it cannot show ${flag}: ${value}`
                            )
                }
                if (redirected()) throw new ScreenUnavailable(redirected())
                const unavailable = await page.evaluate(() =>
                    document.querySelector('[data-capture-unavailable]')?.getAttribute('data-capture-unavailable')
                )
                if (unavailable) throw new ScreenUnavailable(unavailable)
                if (pageErrors.size) throw new ScreenUnavailable(`Application error: ${[...pageErrors].join(', ')}`)
                if (transportError) throw transportError
                const image = storeAsset(assets, previous)
                // Keep the exact PNG as the only CI capture source. The trusted
                // publisher converts it to a full-resolution WebP after diffing.
                results.push({
                    ...metadata,
                    status: 'captured',
                    image,
                    thumbnail: image,
                    ...(copy ? { copy } : {}),
                    ...(screen.flags ? { flags: screen.flags } : {}),
                })
                console.log(`CAPTURED ${screen.id}`)
            } catch (e) {
                if (transportError) throw transportError
                if (!browser.isConnected() || crashed || page.isClosed()) throw e
                if (transportFailures.size) await verifyLiveBuild()
                // Browser waits, actions and declared state checks can fail independently.
                // Filesystem errors, programming errors and browser crashes escape the loop.
                if (
                    !(
                        e instanceof Error &&
                        (e instanceof ScreenUnavailable ||
                            e.name === 'TimeoutError' ||
                            'matcherResult' in e ||
                            /^(page|locator)\.(goto|click|tap|fill|waitFor|evaluate)/.test(e.message))
                    )
                )
                    throw e
                const details = [
                    redirected(),
                    transportFailures.size
                        ? `Local build transport failed: ${[...transportFailures].join(', ')}`
                        : undefined,
                    unknown.size ? `Missing synthetic responses: ${[...unknown].join(', ')}` : undefined,
                    e instanceof ScreenUnavailable ? e.message : `${step}: ${stripVTControlCharacters(e.message)}`,
                ]
                const reason = [...new Set(details.filter(Boolean))].join(' · ').slice(0, 950)
                results.push({ ...metadata, status: 'unavailable', reason })
                console.log(`NOT CAPTURED ${screen.id}: ${reason.split('\n')[0]}`)
            } finally {
                await context.close()
            }
        }
    } finally {
        await browser.close()
    }
    await verifyLiveBuild()
    if (results.length !== catalogue.length) throw new Error('Capture harness did not finish the selected catalogue')
    const capture = {
        finished: true,
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
        copyRecording,
        profile: `${captureLocale}-${profile.name}`,
        width: profile.width,
        height: profile.height,
        device: profile.device,
        screens: results,
        inventory: inventory(source, catalogue),
        adapterFiles: [
            ...(existsSync(join(source, '.screen-capture-adapter.json'))
                ? JSON.parse(readFileSync(join(source, '.screen-capture-adapter.json'), 'utf8')).changed
                : []),
            ...assetOverlays.map(({ file, before, after }) => ({ path: file, before, after })),
        ],
    }
    const report = validateCapture(scope ? scopeCapture(capture, scope) : capture)
    writeFileSync(join(out, 'capture.json.tmp'), JSON.stringify(report, null, 2))
    renameSync(join(out, 'capture.json.tmp'), join(out, 'capture.json'))
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
    process.exitCode = captureExitCode(results)
}
void main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
