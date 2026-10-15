// Local Playwright acceptance for card/preview voting and uncertain-response recovery.
// The local server, identities, manifest, and D1 data are synthetic; browser egress is blocked.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import worker from './worker/index.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(here, '../..')
const publicRoot = resolve(projectRoot, 'public')
const nodeModules = process.env.PLAYWRIGHT_NODE_MODULES ?? resolve(dirname(dirname(process.execPath)), 'node_modules')
const requireFromBundledModules = createRequire(resolve(nodeModules, 'codex-votes-browser.cjs'))
const requireFromTask = createRequire(import.meta.url)
let chromium
for (const load of [
    () => requireFromTask(process.env.PLAYWRIGHT_MODULE || 'playwright'),
    () => requireFromBundledModules(process.env.PLAYWRIGHT_MODULE || 'playwright'),
]) {
    try {
        ;({ chromium } = load())
        break
    } catch {}
}
if (!chromium) throw new Error('Playwright is unavailable; set PLAYWRIGHT_NODE_MODULES or PLAYWRIGHT_MODULE.')

const reportRelativePath = `2026-10-14/pr-123/en/${'a'.repeat(40)}/run-1-1`
const reportPath = `reports/${reportRelativePath}`
const image = `${'a'.repeat(64)}.webp`
const imageRace = `${'b'.repeat(64)}.webp`
const scope = { reportPath, screenId: 'screen-home', locale: 'en', profile: '393x852', image, side: 'after' }
const manifest = {
    schema: 1,
    type: 'capture',
    locale: 'en',
    profile: '393x852',
    width: 393,
    height: 852,
    screens: [
        { id: 'screen-home', name: 'Home', image, status: 'captured', flow: 'Home' },
        { id: 'screen-race', name: 'Identity race', image: imageRace, status: 'captured', flow: 'Home' },
    ],
}
const reportIndex = [
    {
        path: reportRelativePath,
        date: '2026-10-14',
        prNumber: 123,
        locale: 'en',
        profile: '393x852',
        type: 'capture',
        source: 'synthetic',
    },
]
const tinyWebp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64')

function makeD1(db) {
    const prepare = (sql) => {
        let values = []
        const statement = {
            bind(...args) {
                values = args
                return statement
            },
            first() {
                return db.prepare(sql).get(...values) ?? null
            },
            all() {
                return { results: db.prepare(sql).all(...values), success: true }
            },
            run() {
                const result = db.prepare(sql).run(...values)
                return { success: true, meta: { changes: result.changes } }
            },
            _runForBatch() {
                const result = db.prepare(sql).run(...values)
                return { success: true, meta: { changes: result.changes } }
            },
        }
        return statement
    }
    return {
        prepare,
        batch(statements) {
            db.exec('BEGIN IMMEDIATE')
            try {
                const result = statements.map((statement) =>
                    statement._runForBatch ? statement._runForBatch() : statement.run()
                )
                db.exec('COMMIT')
                return result
            } catch (error) {
                db.exec('ROLLBACK')
                throw error
            }
        },
    }
}

const db = new DatabaseSync(':memory:')
const migrations = resolve(here, 'worker/migrations')
for (const name of readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .sort())
    db.exec(readFileSync(resolve(migrations, name), 'utf8'))
const env = {
    COMMENTS: makeD1(db),
    SCREEN_LIBRARY_ACCESS_AUD: 'votes-browser-test',
    REPORTS: {
        async get(key) {
            return key === `${reportPath}/manifest.json` ? { json: async () => manifest } : null
        },
    },
}
let holdNextVoteAtWorker = false
let notifyDelayedVote
let delayedVoteSeen = Promise.resolve()
let releaseDelayedVote
let delayedVoteGate = Promise.resolve()
function contextForActor(actor) {
    const email = actor === 'bob' ? 'bob@example.test' : 'alice@example.test'
    return {
        access: {
            aud: 'votes-browser-test',
            getIdentity: async () => ({ email, name: actor === 'bob' ? 'Bob' : 'Alice' }),
        },
    }
}
const collectBody = (request) =>
    new Promise((resolveBody, reject) => {
        const chunks = []
        request.on('data', (chunk) => chunks.push(chunk))
        request.on('end', () => resolveBody(Buffer.concat(chunks)))
        request.on('error', reject)
    })
function contentType(pathname) {
    if (pathname.endsWith('.html')) return 'text/html; charset=utf-8'
    if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
    if (pathname.endsWith('.css')) return 'text/css; charset=utf-8'
    if (pathname.endsWith('.json')) return 'application/json; charset=utf-8'
    if (pathname.endsWith('.webp')) return 'image/webp'
    return 'application/octet-stream'
}
async function handleRequest(request, response) {
    const url = new URL(request.url, `http://${request.headers.host}`)
    const pathname = decodeURIComponent(url.pathname)
    if (pathname.startsWith('/screen-data/comments/')) {
        const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await collectBody(request)
        if (pathname.endsWith('/votes') && request.method === 'POST' && holdNextVoteAtWorker) {
            holdNextVoteAtWorker = false
            notifyDelayedVote?.()
            await delayedVoteGate
        }
        const result = await worker.fetch(
            new Request(url, {
                method: request.method,
                headers: request.headers,
                ...(body === undefined ? {} : { body }),
            }),
            env,
            contextForActor(request.headers['x-test-actor'])
        )
        response.writeHead(result.status, Object.fromEntries(result.headers))
        response.end(Buffer.from(await result.arrayBuffer()))
        return
    }
    if (pathname === '/screen-data/index.json') {
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        response.end(JSON.stringify(reportIndex))
        return
    }
    if (pathname === `/screen-data/reports/${reportRelativePath}/manifest.json`) {
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        response.end(JSON.stringify(manifest))
        return
    }
    if (/[a-f0-9]{64}\.webp$/.test(pathname)) {
        response.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-store' })
        response.end(tinyWebp)
        return
    }
    const screenRoute = pathname.startsWith('/screens/')
    const assetPath =
        screenRoute && ['viewer.js', 'viewer.css', 'comments.js'].some((name) => pathname.endsWith(`/${name}`))
    const requested = assetPath
        ? `/screen-library/${pathname.split('/').at(-1)}`
        : screenRoute || pathname === '/'
          ? '/screen-library/index.html'
          : pathname
    const diskPath = resolve(publicRoot, `.${requested}`)
    if (!diskPath.startsWith(`${publicRoot}${sep}`)) {
        response.writeHead(400)
        response.end()
        return
    }
    try {
        const body = readFileSync(diskPath)
        response.writeHead(200, { 'content-type': contentType(diskPath), 'cache-control': 'no-store' })
        response.end(body)
    } catch {
        response.writeHead(404, { 'cache-control': 'no-store' })
        response.end('Not found')
    }
}

async function assertPreviewGeometry(page, label) {
    const geometry = await page.evaluate(() => {
        const rect = (selector) => {
            const bounds = document.querySelector(selector)?.getBoundingClientRect()
            return (
                bounds && {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    centerY: bounds.top + bounds.height / 2,
                }
            )
        }
        return {
            stage: rect('.preview-stage'),
            image: rect('#zoom-images .device-frame'),
            feedback: rect('#zoom .screen-feedback'),
            previous: rect('#zoom-prev'),
            next: rect('#zoom-next'),
        }
    })
    assert.ok(
        geometry.feedback && geometry.image && geometry.stage && geometry.previous && geometry.next,
        `${label} preview elements exist`
    )
    assert.ok(
        geometry.feedback.top >= geometry.image.bottom - 1,
        `${label} vote feedback sits below preview images: ${JSON.stringify(geometry)}`
    )
    assert.ok(
        geometry.feedback.left >= geometry.stage.left - 1 && geometry.feedback.right <= geometry.stage.right + 1,
        `${label} vote feedback spans the preview stage: ${JSON.stringify(geometry)}`
    )
    assert.ok(
        geometry.previous.right <= geometry.image.left + 4 && geometry.next.left >= geometry.image.right - 4,
        `${label} navigation arrows stay on opposite sides of the image: ${JSON.stringify(geometry)}`
    )
    assert.ok(
        Math.abs(geometry.previous.centerY - geometry.next.centerY) <= 2,
        `${label} previous and next arrows share a row: ${JSON.stringify(geometry)}`
    )
}

async function main() {
    const server = createServer((request, response) =>
        handleRequest(request, response).catch((error) => {
            if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain' })
            response.end('Local vote fixture failed')
            console.error(error.message)
        })
    )
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const origin = `http://127.0.0.1:${server.address().port}`
    let browser
    const requests = []
    const pageErrors = []
    try {
        const launchOptions = { headless: true }
        if (process.env.PLAYWRIGHT_EXECUTABLE_PATH)
            launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH
        browser = await chromium.launch(launchOptions)
        const alice = await browser.newContext({
            viewport: { width: 390, height: 844 },
            extraHTTPHeaders: { 'x-test-actor': 'alice' },
        })
        const bob = await browser.newContext({
            viewport: { width: 390, height: 844 },
            extraHTTPHeaders: { 'x-test-actor': 'bob' },
        })
        for (const context of [alice, bob])
            context.route('**/*', (route) =>
                new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient')
            )
        const alicePage = await alice.newPage()
        alicePage.on('pageerror', (error) => pageErrors.push(error.message))
        alicePage.on('request', (request) => {
            if (new URL(request.url()).pathname.endsWith('/votes'))
                requests.push({ body: JSON.parse(request.postData() || '{}') })
        })
        const reportUrl = `${origin}/screens/${reportRelativePath}/?source=synthetic&locale=en`
        await alicePage.goto(reportUrl, { waitUntil: 'domcontentloaded' })
        await alicePage.locator('#screen-home').waitFor({ state: 'visible', timeout: 8000 })
        const card = alicePage.locator('#screen-home .screen-votes')
        await card.waitFor({ state: 'visible', timeout: 8000 })
        const up = card.locator('[data-vote="1"]')
        const down = card.locator('[data-vote="-1"]')
        const upCount = card.locator('[data-vote-count="up"]')
        const downCount = card.locator('[data-vote-count="down"]')
        await up.waitFor({ state: 'visible' })
        assert.equal(await up.getAttribute('aria-pressed'), 'false')
        assert.equal(await down.getAttribute('aria-pressed'), 'false')
        const upName = (await up.getAttribute('aria-label')) ?? (await up.innerText())
        const downName = (await down.getAttribute('aria-label')) ?? (await down.innerText())
        assert.match(upName, /thumbs?\s*up/i)
        assert.match(upName, /after/i, 'accessible name identifies the screenshot side')
        assert.match(downName, /thumbs?\s*down/i)
        assert.match(downName, /after/i, 'accessible name identifies the screenshot side')

        // A real D1 commit whose response is hidden simulates a lost response. The
        // widget must keep totals unchanged and expose an explicit same-intent retry.
        let hideFirstResponse = true
        let releaseFirstRequest
        let notifyFirstRequest
        const firstRequestSeen = new Promise((resolveSeen) => {
            notifyFirstRequest = resolveSeen
        })
        const holdFirstRequest = new Promise((resolveRelease) => {
            releaseFirstRequest = resolveRelease
        })
        await alicePage.route('**/screen-data/comments/votes', async (route) => {
            if (hideFirstResponse && route.request().method() === 'POST') {
                hideFirstResponse = false
                notifyFirstRequest()
                await holdFirstRequest
                const committed = await route.fetch()
                assert.equal(committed.status(), 200)
                await route.fulfill({
                    status: 503,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Synthetic response loss' }),
                })
                return
            }
            await route.continue()
        })
        const firstClick = up.click()
        await firstRequestSeen
        assert.equal(await upCount.textContent(), '0', 'pending request does not optimistically increment totals')
        assert.equal(await downCount.textContent(), '0')
        assert.equal(await up.isDisabled(), true, 'duplicate pending vote action is disabled')
        releaseFirstRequest()
        await firstClick
        await card.locator('[data-vote-retry]').waitFor({ state: 'visible', timeout: 8000 })
        assert.equal(await upCount.textContent(), '0', 'unknown outcome must not optimistically increment totals')
        assert.equal(await downCount.textContent(), '0')
        assert.equal(
            await card
                .locator('[data-vote-status]')
                .textContent()
                .then((value) => value.trim())
                .then(Boolean),
            true
        )
        assert.equal(requests.length, 1, 'mutation is not automatically retried')
        const firstIntent = requests[0].body
        await card.locator('[data-vote-retry]').click()
        await alicePage.waitForFunction(
            () => {
                const card = document.querySelector('#screen-home .screen-votes')
                return (
                    card?.querySelector('[data-vote-count="up"]')?.textContent?.trim() === '1' &&
                    card?.querySelector('[data-vote-retry]')?.hidden !== false
                )
            },
            undefined,
            { timeout: 8000 }
        )
        assert.equal(requests.length, 2)
        assert.deepEqual(requests[1].body, firstIntent, 'explicit retry retains UUID, value, and expected version')
        assert.equal(await up.getAttribute('aria-pressed'), 'true')

        // Clicking the rendered screenshot opens the enlarged preview with the same vote scope.
        await alicePage.locator('#screen-home').getByRole('button', { name: 'Enlarge Home, Screen' }).click()
        const preview = alicePage.locator('#zoom .screen-votes')
        await preview.waitFor({ state: 'visible', timeout: 8000 })
        assert.equal(await preview.locator('[data-vote-count="up"]').textContent(), '1')
        assert.equal(await preview.locator('[data-vote="1"]').getAttribute('aria-pressed'), 'true')

        const bobPage = await bob.newPage()
        bobPage.on('pageerror', (error) => pageErrors.push(error.message))
        let failBobSummary = true
        await bobPage.route('**/screen-data/comments/votes/summary', async (route) => {
            if (failBobSummary && route.request().method() === 'POST') {
                failBobSummary = false
                await route.fulfill({
                    status: 503,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Synthetic summary outage' }),
                })
                return
            }
            await route.continue()
        })
        await bobPage.goto(reportUrl, { waitUntil: 'domcontentloaded' })
        const bobCard = bobPage.locator('#screen-home .screen-votes')
        await bobCard.waitFor({ state: 'visible', timeout: 8000 })
        await bobCard
            .locator('[data-vote-status]')
            .filter({ hasText: 'Votes unavailable' })
            .waitFor({ state: 'visible', timeout: 8000 })
        await bobCard.locator('[data-vote-refresh]').click()
        await bobPage.waitForFunction(
            () =>
                document.querySelector('#screen-home .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                '1',
            undefined,
            { timeout: 8000 }
        )
        assert.equal(await bobCard.locator('[data-vote-count="up"]').textContent(), '1')
        assert.equal(
            await bobCard.locator('[data-vote="1"]').getAttribute('aria-pressed'),
            'false',
            'Bob does not inherit Alice choice'
        )
        await bobCard.locator('[data-vote="-1"]').click()
        await bobPage.waitForFunction(
            () => {
                const card = document.querySelector('#screen-home .screen-votes')
                return (
                    card?.querySelector('[data-vote-count="up"]')?.textContent?.trim() === '1' &&
                    card?.querySelector('[data-vote-count="down"]')?.textContent?.trim() === '1'
                )
            },
            undefined,
            { timeout: 8000 }
        )
        assert.equal(
            await preview.locator('[data-vote-refresh]').isVisible(),
            false,
            'refresh stays hidden until a vote error needs it'
        )
        await alicePage.evaluate(() => window.dispatchEvent(new Event('focus')))
        await alicePage.waitForFunction(
            () => document.querySelector('#zoom .screen-votes [data-vote-count="down"]')?.textContent?.trim() === '1',
            undefined,
            { timeout: 8000 }
        )
        const aliceUpPreview = preview.locator('[data-vote="1"]')
        await aliceUpPreview.click()
        await alicePage.waitForFunction(
            () => document.querySelector('#zoom .screen-votes [data-vote-count="up"]')?.textContent?.trim() === '0',
            undefined,
            { timeout: 8000 }
        )
        assert.equal(await aliceUpPreview.getAttribute('aria-pressed'), 'false', 'selected side toggles to neutral')
        await alicePage.keyboard.press('Escape')
        await alicePage.locator('#zoom').waitFor({ state: 'hidden' })
        await alicePage.reload({ waitUntil: 'domcontentloaded' })
        await alicePage
            .locator('#screen-home .screen-votes [data-vote="1"][aria-pressed="false"]')
            .waitFor({ state: 'visible', timeout: 8000 })
        await alicePage.waitForFunction(
            () =>
                document.querySelector('#screen-home .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                    '0' &&
                document.querySelector('#screen-home .screen-votes [data-vote-count="down"]')?.textContent?.trim() ===
                    '1',
            undefined,
            { timeout: 8000 }
        )
        assert.equal(await alicePage.locator('#screen-home .screen-votes [data-vote-count="up"]').textContent(), '0')
        assert.equal(await alicePage.locator('#screen-home .screen-votes [data-vote-count="down"]').textContent(), '1')

        // Vote activity reaches the feed; a vote item opens its screen without a discussion.
        const voteItems = alicePage.locator('#comment-feed .vote-feed-item')
        await voteItems.first().waitFor({ state: 'visible', timeout: 8000 })
        assert.deepEqual(
            await voteItems.evaluateAll((items) =>
                items.map((item) => item.querySelector('.vote-feed-action')?.textContent?.trim())
            ),
            ['Removed their upvote', 'Downvoted', 'Upvoted'],
            'replays and retries add no duplicate activity'
        )
        assert.match(await voteItems.nth(1).innerText(), /Bob[\s\S]*Downvoted[\s\S]*Home · en/)
        await voteItems.nth(1).click()
        await alicePage.locator('#zoom').waitFor({ state: 'visible', timeout: 8000 })
        assert.equal(await alicePage.locator('#comment-panel').isVisible(), false)
        assert.equal(new URL(alicePage.url()).searchParams.has('comments'), false)
        await alicePage.keyboard.press('Escape')
        await alicePage.locator('#zoom').waitFor({ state: 'hidden' })

        await alicePage.setViewportSize({ width: 1024, height: 768 })
        await alicePage.locator('#screen-home').getByRole('button', { name: 'Enlarge Home, Screen' }).click()
        const desktopPreview = alicePage.locator('#zoom .screen-votes')
        await desktopPreview.waitFor({ state: 'visible' })
        await assertPreviewGeometry(alicePage, 'desktop')
        await alicePage.locator('#zoom').screenshot({ path: '/private/tmp/peanut-screen-voting-preview-desktop.png' })
        await alicePage.keyboard.press('Escape')
        await alicePage.locator('#zoom').waitFor({ state: 'hidden' })

        await alicePage.setViewportSize({ width: 320, height: 712 })
        const mobileCard = alicePage.locator('#screen-home .screen-votes')
        await mobileCard.waitFor({ state: 'visible' })
        const cardBounds = await mobileCard.boundingBox()
        assert.ok(
            cardBounds && cardBounds.x >= 0 && cardBounds.x + cardBounds.width <= 320,
            `feedback fits 320px viewport: ${JSON.stringify(cardBounds)}`
        )
        await alicePage.locator('#screen-home').getByRole('button', { name: 'Enlarge Home, Screen' }).click()
        const mobilePreview = alicePage.locator('#zoom .screen-votes')
        await mobilePreview.waitFor({ state: 'visible' })
        await assertPreviewGeometry(alicePage, 'mobile')
        const previewBounds = await mobilePreview.boundingBox()
        assert.ok(
            previewBounds && previewBounds.x >= 0 && previewBounds.x + previewBounds.width <= 320,
            `preview feedback fits 320px viewport: ${JSON.stringify(previewBounds)}`
        )
        await alicePage.locator('#zoom').screenshot({ path: '/private/tmp/peanut-screen-voting-preview.png' })

        // Hold the post-click /me response generated as Alice, switch the local
        // identity to Bob, then release Alice's result. The intent must retain the
        // identity that created its request UUID; the server rejects the mismatch.
        const switchContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            extraHTTPHeaders: { 'x-test-actor': 'alice' },
        })
        await switchContext.route('**/*', (route) =>
            new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient')
        )
        const switchPage = await switchContext.newPage()
        switchPage.on('pageerror', (error) => pageErrors.push(error.message))
        let switchVoteBody
        let switchVoteStatus
        switchPage.on('request', (request) => {
            if (new URL(request.url()).pathname.endsWith('/votes'))
                switchVoteBody = JSON.parse(request.postData() || '{}')
        })
        switchPage.on('response', (response) => {
            if (new URL(response.url()).pathname.endsWith('/votes')) switchVoteStatus = response.status()
        })
        await switchPage.goto(reportUrl, { waitUntil: 'domcontentloaded' })
        const raceCard = switchPage.locator('#screen-race .screen-votes')
        await raceCard.waitFor({ state: 'visible', timeout: 8000 })
        await raceCard.locator('[data-vote="1"]').waitFor({ state: 'visible' })
        await switchPage.waitForFunction(
            () =>
                document.querySelector('#screen-race .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                '0',
            undefined,
            { timeout: 8000 }
        )
        let releaseAliceMe
        let notifyAliceMe
        const aliceMeSeen = new Promise((resolveSeen) => {
            notifyAliceMe = resolveSeen
        })
        const holdAliceMe = new Promise((resolveRelease) => {
            releaseAliceMe = resolveRelease
        })
        await switchPage.route('**/screen-data/comments/me', async (route) => {
            notifyAliceMe()
            await holdAliceMe
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'cache-control': 'no-store' },
                body: JSON.stringify({
                    user: { id: 'alice@example.test', email: 'alice@example.test', name: 'Alice' },
                }),
            })
        })
        const raceClick = raceCard.locator('[data-vote="1"]').click()
        await aliceMeSeen
        await switchContext.setExtraHTTPHeaders({ 'x-test-actor': 'bob' })
        releaseAliceMe()
        await raceClick
        await switchPage.waitForFunction(
            () =>
                document
                    .querySelector('#screen-race .screen-votes [data-vote-status]')
                    ?.textContent?.includes('Voting is not permitted'),
            undefined,
            { timeout: 8000 }
        )
        assert.equal(switchVoteStatus, 403, 'verified identity switch rejects the stale Alice intent')
        assert.equal(
            switchVoteBody?.actorId,
            'alice@example.test',
            'intent binds its marker to the identity that created the UUID'
        )
        await switchPage.evaluate(() => window.dispatchEvent(new Event('focus')))
        await switchPage.waitForFunction(
            () =>
                document.querySelector('#screen-race .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                    '0' &&
                document.querySelector('#screen-race .screen-votes [data-vote="1"]')?.getAttribute('aria-pressed') ===
                    'false',
            undefined,
            { timeout: 8000 }
        )
        const raceRows = db
            .prepare('SELECT count(*) AS n FROM screen_votes WHERE scope_key = ?')
            .get(JSON.stringify([reportPath, 'screen-race', 'en', '393x852', imageRace, 'after'])).n
        assert.equal(raceRows, 0, 'Alice response cannot create a Bob vote after identity changes')
        await switchContext.close()

        // Keep the original server-side mutation before D1 while delivering a
        // synthetic failure to the page. Refreshing at the unchanged version
        // must retain uncertainty and the exact retry intent.
        const refreshContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            extraHTTPHeaders: { 'x-test-actor': 'alice' },
        })
        await refreshContext.route('**/*', (route) =>
            new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient')
        )
        const refreshPage = await refreshContext.newPage()
        refreshPage.on('pageerror', (error) => pageErrors.push(error.message))
        let deferredCommit
        let firstRefreshIntent
        let refreshIntentCount = 0
        await refreshPage.on('request', (request) => {
            if (new URL(request.url()).pathname.endsWith('/votes')) {
                refreshIntentCount++
                if (!firstRefreshIntent) firstRefreshIntent = JSON.parse(request.postData() || '{}')
            }
        })
        await refreshPage.goto(reportUrl, { waitUntil: 'domcontentloaded' })
        const uncertainCard = refreshPage.locator('#screen-race .screen-votes')
        await uncertainCard.waitFor({ state: 'visible', timeout: 8000 })
        await refreshPage.waitForFunction(
            () =>
                document.querySelector('#screen-race .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                '0',
            undefined,
            { timeout: 8000 }
        )
        holdNextVoteAtWorker = true
        delayedVoteSeen = new Promise((resolveSeen) => {
            notifyDelayedVote = resolveSeen
        })
        delayedVoteGate = new Promise((resolveRelease) => {
            releaseDelayedVote = resolveRelease
        })
        let returnSyntheticFailure = true
        await refreshPage.route('**/screen-data/comments/votes', async (route) => {
            if (returnSyntheticFailure && route.request().method() === 'POST') {
                returnSyntheticFailure = false
                deferredCommit = route.fetch()
                await route.fulfill({
                    status: 503,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Synthetic pre-commit delay' }),
                })
                return
            }
            await route.continue()
        })
        await uncertainCard.locator('[data-vote="1"]').click()
        await delayedVoteSeen
        await uncertainCard.locator('[data-vote-retry]').waitFor({ state: 'visible', timeout: 8000 })
        assert.equal(refreshIntentCount, 1)
        const uncertainIntent = firstRefreshIntent
        assert.ok(uncertainIntent?.requestId)
        const uncertainScopeKey = JSON.stringify([reportPath, 'screen-race', 'en', '393x852', imageRace, 'after'])
        let refreshedPersonalState
        let notifyRefreshedSummary
        const refreshedSummary = new Promise((resolveSummary) => {
            notifyRefreshedSummary = resolveSummary
        })
        refreshPage.on('response', async (response) => {
            if (new URL(response.url()).pathname.endsWith('/votes/summary') && response.request().method() === 'POST') {
                const data = await response.json().catch(() => null)
                const vote = data?.votes?.find((candidate) => candidate.key === uncertainScopeKey)
                if (vote) {
                    refreshedPersonalState = vote
                    notifyRefreshedSummary(vote)
                }
            }
        })
        await uncertainCard.locator('[data-vote-refresh]').click()
        const refreshedVote = await refreshedSummary
        assert.equal(
            refreshedVote.version,
            uncertainIntent.version,
            'refresh reads the unchanged actor version before late commit'
        )
        await refreshPage.waitForFunction(
            () =>
                document.querySelector('#screen-race .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                    '0' &&
                document.querySelector('#screen-race .screen-votes [data-vote-count="down"]')?.textContent?.trim() ===
                    '0',
            undefined,
            { timeout: 8000 }
        )
        assert.equal(
            await uncertainCard.locator('[data-vote-retry]').isVisible(),
            true,
            'same-version refresh retains explicit retry'
        )
        assert.equal(
            await uncertainCard.locator('[data-vote="1"]').isDisabled(),
            true,
            'uncertain intent blocks a new vote'
        )
        assert.equal(refreshIntentCount, 1, 'refresh did not send a second mutation')
        assert.equal(refreshedPersonalState?.version, uncertainIntent.version)
        releaseDelayedVote()
        const lateResponse = await deferredCommit
        assert.equal(lateResponse.status(), 200, 'held request commits after the refresh read')
        await uncertainCard.locator('[data-vote-retry]').click()
        await refreshPage.waitForFunction(
            () =>
                document.querySelector('#screen-race .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                    '1' && document.querySelector('#screen-race .screen-votes [data-vote-retry]')?.hidden !== false,
            undefined,
            { timeout: 8000 }
        )
        assert.equal(refreshIntentCount, 2)
        let returnConflict = true
        await refreshPage.route('**/screen-data/comments/votes', async (route) => {
            if (returnConflict && route.request().method() === 'POST') {
                returnConflict = false
                await route.fulfill({
                    status: 409,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Version conflict' }),
                })
                return
            }
            await route.continue()
        })
        await uncertainCard.locator('[data-vote="-1"]').click()
        await uncertainCard
            .locator('[data-vote-status]')
            .filter({ hasText: 'Vote changed' })
            .waitFor({ state: 'visible', timeout: 8000 })
        assert.equal(
            await uncertainCard.locator('[data-vote-retry]').isVisible(),
            false,
            'definitive conflict is not retryable'
        )
        await uncertainCard.locator('[data-vote-refresh]').click()
        await refreshPage.waitForFunction(
            () =>
                document.querySelector('#screen-race .screen-votes [data-vote-count="up"]')?.textContent?.trim() ===
                    '1' &&
                document.querySelector('#screen-race .screen-votes [data-vote-count="down"]')?.textContent?.trim() ===
                    '0' &&
                document.querySelector('#screen-race .screen-votes [data-vote="1"]')?.getAttribute('aria-pressed') ===
                    'true' &&
                document.querySelector('#screen-race .screen-votes [data-vote="-1"]')?.disabled === false,
            undefined,
            { timeout: 8000 }
        )
        assert.equal(
            await uncertainCard.locator('[data-vote="-1"]').isDisabled(),
            false,
            'refresh clears a definitive conflict at the same revision'
        )
        await refreshContext.close()

        // A discussion whose screen later leaves the report must open in place;
        // redirecting to the same report URL would loop forever.
        const created = await fetch(`${origin}/screen-data/comments/threads`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin, 'x-test-actor': 'alice' },
            body: JSON.stringify({
                scope: { ...scope, screenId: 'screen-race', image: imageRace },
                body: 'Retained discussion',
                requestId: crypto.randomUUID(),
            }),
        })
        assert.equal(created.status, 201)
        const retainedThread = (await created.json()).thread.id
        const removed = manifest.screens.splice(1, 1)
        try {
            const retainedPage = await alice.newPage()
            retainedPage.on('pageerror', (error) => pageErrors.push(error.message))
            let navigations = 0
            retainedPage.on('request', (request) => {
                if (request.isNavigationRequest() && request.frame() === retainedPage.mainFrame()) navigations++
            })
            await retainedPage.goto(`${reportUrl}&comments=${retainedThread}`, { waitUntil: 'domcontentloaded' })
            await retainedPage
                .locator('#zoom-position')
                .filter({ hasText: 'No longer in this report' })
                .waitFor({ state: 'visible', timeout: 8000 })
            await retainedPage
                .locator('#comment-panel')
                .getByText('Retained discussion')
                .waitFor({ state: 'visible', timeout: 8000 })
            await retainedPage.waitForTimeout(500)
            assert.equal(navigations, 1, 'a retained discussion for a removed screen does not redirect')
            await retainedPage.close()
        } finally {
            manifest.screens.splice(1, 0, ...removed)
        }

        // "My votes" follows the signed-in person, reloads on an account switch,
        // and "All teammates" falls back to shared totals.
        const reportOrder = manifest.screens.map((screen) => screen.id)
        const screensOf = (rows) => reportOrder.filter((id) => rows.some((row) => JSON.parse(row.scope_key)[1] === id))
        const votedBy = (actor, value) =>
            screensOf(
                db.prepare('SELECT scope_key FROM screen_votes WHERE actor_id = ? AND value = ?').all(actor, value)
            )
        const votedByAnyone = (value) =>
            screensOf(db.prepare('SELECT scope_key FROM screen_votes WHERE value = ?').all(value))
        assert.notDeepEqual(
            votedBy('alice@example.test', -1),
            votedBy('bob@example.test', -1),
            'fixture separates people'
        )
        const scopeContext = await browser.newContext({
            viewport: { width: 1024, height: 768 },
            extraHTTPHeaders: { 'x-test-actor': 'alice' },
        })
        await scopeContext.route('**/*', (route) =>
            new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient')
        )
        const scopePage = await scopeContext.newPage()
        scopePage.on('pageerror', (error) => pageErrors.push(error.message))
        const shows = (ids, emptyText) =>
            scopePage.waitForFunction(
                ([expected, empty]) => {
                    const tiles = [...document.querySelectorAll('#screens > article.tile')].map((tile) => tile.id)
                    const notice = document.querySelector('#screens .filter-notice p')?.textContent ?? ''
                    return expected.length
                        ? JSON.stringify(tiles) === JSON.stringify(expected)
                        : !tiles.length && notice.includes(empty)
                },
                [ids, emptyText],
                { timeout: 8000 }
            )
        await scopePage.goto(`${reportUrl}&votes=down&by=me`, { waitUntil: 'domcontentloaded' })
        await shows(votedBy('alice@example.test', -1), "You haven't downvoted")
        assert.equal(await scopePage.locator('#vote-scope-me').isChecked(), true)
        await scopeContext.setExtraHTTPHeaders({ 'x-test-actor': 'bob' })
        await scopePage.evaluate(() => window.dispatchEvent(new Event('focus')))
        await shows(votedBy('bob@example.test', -1), "You haven't downvoted")
        await scopePage.locator('label:has(#vote-scope-all) > span').click()
        await shows(votedByAnyone(-1), 'No downvoted screens')
        assert.equal(new URL(scopePage.url()).searchParams.has('by'), false)
        assert.equal(new URL(scopePage.url()).searchParams.get('votes'), 'down')
        await scopePage.selectOption('#votes', '')
        await scopePage.locator('#vote-scope-control').waitFor({ state: 'hidden' })
        assert.equal(new URL(scopePage.url()).searchParams.has('votes'), false)
        await scopePage.selectOption('#votes', 'up,down')
        await scopePage.locator('#vote-scope-control').waitFor({ state: 'visible' })
        await shows(
            votedByAnyone(1)
                .concat(votedByAnyone(-1))
                .filter((id, i, all) => all.indexOf(id) === i)
                .sort((a, b) => reportOrder.indexOf(a) - reportOrder.indexOf(b)),
            'No voted screens'
        )
        assert.equal(new URL(scopePage.url()).searchParams.get('votes'), 'up,down')
        // Removing your own vote drops the card from My votes as soon as the save settles.
        await scopePage.locator('label:has(#vote-scope-me) > span').click()
        const bobVoted = reportOrder.filter(
            (id) => votedBy('bob@example.test', 1).includes(id) || votedBy('bob@example.test', -1).includes(id)
        )
        assert.ok(bobVoted.length, 'Bob has a vote to remove')
        await shows(bobVoted, "You haven't voted")
        await scopePage.locator(`#${bobVoted[0]} .tile-foot [data-vote][aria-pressed="true"]`).click()
        await shows(bobVoted.slice(1), "You haven't voted")
        assert.equal(new URL(scopePage.url()).searchParams.get('by'), 'me')
        await scopeContext.close()
        assert.deepEqual(pageErrors, [], 'public viewer has no uncaught browser errors')
        console.log(
            `Screen voting browser acceptance passed: Alice/Bob, retry/refresh races, identity switch, 320px preview, reload (${requests.length} Alice mutation requests).`
        )
    } finally {
        releaseDelayedVote?.()
        await browser?.close()
        db.close()
        await new Promise((resolveClose) => server.close(resolveClose))
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
