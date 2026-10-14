// Manual Playwright integration check. Run directly with the bundled Node runtime:
// node scripts/screens/comments-browser.mjs
// It starts an isolated local server and uses only synthetic Alice/Bob identities.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import worker from './worker/index.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(here, '../..')
const publicRoot = resolve(projectRoot, 'public')
const nodeModules = process.env.PLAYWRIGHT_NODE_MODULES ?? resolve(dirname(dirname(process.execPath)), 'node_modules')
const requireFromBundledModules = createRequire(resolve(nodeModules, 'codex-comments-browser.cjs'))
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
const migrationsPath = resolve(here, 'worker/migrations')

const reportRelativePath = `2026-10-14/pr-123/en/${'a'.repeat(40)}/run-1-1`
const reportPath = `reports/${reportRelativePath}`
const imageBefore = `${'a'.repeat(64)}.webp`
const imageAfter = `${'b'.repeat(64)}.webp`
const rootBody = '  Browser <b>literal</b> whitespace\nkept 🌱  '
const replyBody = 'A reply from Alice'
const editedBody = '  Edited <img src=x onerror=alert(1)> text\nkept 🧪  '
const screenshotDirectory = process.env.PEANUT_COMMENTS_SCREENSHOT_DIR || tmpdir()

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
                return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } }
            },
            _runForBatch() {
                const result = db.prepare(sql).run(...values)
                return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } }
            },
        }
        return statement
    }
    return {
        prepare,
        batch(statements) {
            db.exec('BEGIN IMMEDIATE')
            try {
                const results = statements.map((statement) => statement._runForBatch())
                db.exec('COMMIT')
                return results
            } catch (error) {
                db.exec('ROLLBACK')
                throw error
            }
        },
    }
}

const manifest = {
    schema: 1,
    type: 'comparison',
    locale: 'en',
    profile: '393x852',
    complete: true,
    before: { locale: 'en', profile: '393x852', width: 393, height: 852, commit: 'a'.repeat(40) },
    after: { locale: 'en', profile: '393x852', width: 393, height: 852, commit: 'b'.repeat(40) },
    screens: [
        {
            id: 'screen-home',
            name: 'Home',
            before: { image: imageBefore, status: 'captured' },
            after: { image: imageAfter, status: 'captured' },
            status: 'changed',
        },
    ],
}

const reportIndex = [
    {
        path: reportRelativePath,
        date: '2026-10-14',
        prNumber: 123,
        locale: 'en',
        profile: '393x852',
        type: 'comparison',
        reportType: 'comparison',
        source: 'synthetic',
    },
]

const tinyWebp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64')

const db = new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys = ON')
for (const migrationName of readdirSync(migrationsPath)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort())
    db.exec(readFileSync(resolve(migrationsPath, migrationName), 'utf8'))
const env = {
    COMMENTS: makeD1(db),
    SCREEN_LIBRARY_ACCESS_AUD: 'test-audience',
    SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: 'unit.cloudflareaccess.com',
    REPORTS: {
        async get(key) {
            if (key === `${reportPath}/manifest.json` || key === `${reportRelativePath}/manifest.json`) {
                return { json: async () => manifest, text: async () => JSON.stringify(manifest), body: null }
            }
            if (key === 'screen-library/index.json' || key === 'index.json' || key.endsWith('/index.json')) {
                return { json: async () => reportIndex, text: async () => JSON.stringify(reportIndex), body: null }
            }
            if (key.endsWith(imageBefore) || key.endsWith(imageAfter)) {
                return { arrayBuffer: async () => tinyWebp.buffer, body: tinyWebp }
            }
            return null
        },
    },
}

function contextForActor(actor) {
    const user =
        actor === 'alice'
            ? { email: 'alice@peanut.me', name: 'Alice' }
            : actor === 'bob'
              ? { email: 'bob@peanut.me', name: 'Bob' }
              : null
    return user ? { access: { aud: 'test-audience', getIdentity: async () => user } } : {}
}

function collectBody(request) {
    return new Promise((resolveBody, reject) => {
        const chunks = []
        request.on('data', (chunk) => chunks.push(chunk))
        request.on('end', () => resolveBody(Buffer.concat(chunks)))
        request.on('error', reject)
    })
}

function contentType(pathname) {
    if (pathname.endsWith('.html')) return 'text/html; charset=utf-8'
    if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
    if (pathname.endsWith('.css')) return 'text/css; charset=utf-8'
    if (pathname.endsWith('.json')) return 'application/json; charset=utf-8'
    if (pathname.endsWith('.webp')) return 'image/webp'
    if (pathname.endsWith('.svg')) return 'image/svg+xml'
    return 'application/octet-stream'
}

function objectResponse(object, mimeType) {
    if (!object) return null
    const body = object.body ?? object.bytes
    if (body) return { body: Buffer.from(body), mimeType }
    return null
}

async function handleRequest(request, response) {
    const url = new URL(request.url, `http://${request.headers.host}`)
    const pathname = decodeURIComponent(url.pathname)
    if (pathname.startsWith('/screen-data/comments/')) {
        const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await collectBody(request)
        const workerRequest = new Request(url, {
            method: request.method,
            headers: request.headers,
            ...(body === undefined ? {} : { body }),
        })
        const result = await worker.fetch(workerRequest, env, contextForActor(request.headers['x-test-actor']))
        response.writeHead(result.status, Object.fromEntries(result.headers))
        response.end(Buffer.from(await result.arrayBuffer()))
        return
    }

    if (pathname.startsWith('/screen-data/')) {
        const key = decodeURIComponent(pathname.slice('/screen-data/'.length))
        const object =
            key.startsWith('reports/') || key.endsWith('manifest.json')
                ? { body: Buffer.from(JSON.stringify(manifest)) }
                : key.endsWith('index.json')
                  ? { body: Buffer.from(JSON.stringify(reportIndex)) }
                  : key.includes('/assets/') || key.endsWith(imageBefore) || key.endsWith(imageAfter)
                    ? { body: tinyWebp }
                    : null
        if (!object) {
            response.writeHead(404, { 'cache-control': 'no-store' })
            response.end('Not found')
            return
        }
        response.writeHead(200, { 'content-type': contentType(key), 'cache-control': 'no-store' })
        response.end(object.body)
        return
    }

    if (pathname === '/screen-library/index.json' || pathname === '/index.json' || pathname.endsWith('/index.json')) {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        response.end(JSON.stringify(reportIndex))
        return
    }
    if (
        pathname.endsWith('/manifest.json') &&
        (pathname.includes(reportRelativePath) || pathname.includes(reportPath))
    ) {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        response.end(JSON.stringify(manifest))
        return
    }
    if (pathname.endsWith(imageBefore) || pathname.endsWith(imageAfter)) {
        response.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-store' })
        response.end(tinyWebp)
        return
    }

    const isScreenRoute = pathname.startsWith('/screens/')
    const isViewerAsset =
        isScreenRoute && ['viewer.js', 'viewer.css', 'comments.js'].some((name) => pathname.endsWith(`/${name}`))
    const requestedPath = isViewerAsset
        ? `/screen-library/${pathname.split('/').at(-1)}`
        : pathname === '/' || isScreenRoute
          ? '/screen-library/index.html'
          : pathname
    const diskPath = resolve(publicRoot, `.${requestedPath}`)
    if (!diskPath.startsWith(`${publicRoot}${sep}`)) {
        response.writeHead(400)
        response.end('Invalid path')
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

async function waitVisible(locator, label) {
    try {
        await locator.waitFor({ state: 'visible', timeout: 6000 })
    } catch {
        throw new Error(`Missing browser feature: ${label}`)
    }
}

async function openComments(page) {
    const panel = page.locator('#zoom #comment-panel')
    if (await panel.isVisible()) return
    const dialog = page.locator('#zoom')
    if (await dialog.isVisible()) {
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden', timeout: 5000 })
    }
    const badge = page.locator('#screen-home button.comment-count[data-comment-side="after"]')
    await waitVisible(badge, 'after-image comment badge inside #screen-home')
    await badge.click()
    await waitVisible(panel, '#comment-panel inside #zoom dialog')
}

async function selectThreadFromFeed(page, threadId, label) {
    const dialog = page.locator('#zoom')
    if (await dialog.isVisible()) {
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden', timeout: 5000 })
    }
    const matchingFeedItems = page.locator(`#comment-feed [data-thread-id="${threadId}"]`)
    let feedItem
    try {
        await page.waitForFunction(
            (id) =>
                Array.from(document.querySelectorAll('#comment-feed [data-thread-id]')).some(
                    (node) => node.getAttribute('data-thread-id') === id && node.getClientRects().length > 0
                ),
            threadId,
            { timeout: 6000 }
        )
        for (let i = 0; i < (await matchingFeedItems.count()); i += 1) {
            const candidate = matchingFeedItems.nth(i)
            if (await candidate.isVisible()) {
                feedItem = candidate
                break
            }
        }
        if (!feedItem) await waitVisible(matchingFeedItems.first(), `${label} feed excerpt`)
    } catch (error) {
        const feedText = await page
            .locator('#comment-feed')
            .innerText()
            .catch(() => '<feed unavailable>')
        const feedVisible = await matchingFeedItems
            .first()
            .isVisible()
            .catch(() => false)
        const dialogVisible = await dialog.isVisible().catch(() => false)
        const feedState = await matchingFeedItems
            .evaluateAll((nodes) =>
                nodes.map((node) => {
                    const style = getComputedStyle(node)
                    const rect = node.getBoundingClientRect()
                    return {
                        threadId: node.getAttribute('data-thread-id'),
                        display: style.display,
                        visibility: style.visibility,
                        width: rect.width,
                        height: rect.height,
                    }
                })
            )
            .catch(() => [])
        const feedItems = await page
            .locator('#comment-feed [data-thread-id]')
            .evaluateAll((nodes) =>
                nodes.map((node) => ({
                    threadId: node.getAttribute('data-thread-id'),
                    commentId: node.getAttribute('data-comment-id'),
                    text: node.textContent,
                }))
            )
            .catch(() => [])
        console.error(
            JSON.stringify({ label, threadId, feedText, feedItems, feedVisible, dialogVisible, feedState }, null, 2)
        )
        await page
            .screenshot({ path: '/private/tmp/peanut-comments-browser-feed-selection-failure.png', fullPage: true })
            .catch(() => {})
        throw error
    }
    if (!feedItem) throw new Error(`Missing visible ${label} feed excerpt for thread ${threadId}`)
    await feedItem.click()
    const panelThread = page.locator(`#comment-panel [data-thread-id="${threadId}"]`)
    await waitVisible(panelThread, `${label} selected thread in #comment-panel`)
    return { feedItem, panelThread }
}

async function openReportPage(context, origin, reportUrl, label) {
    const page = await context.newPage()
    page.on('pageerror', (error) => console.error(`${label} browser error: ${error.message}`))
    await page.goto(reportUrl, { waitUntil: 'domcontentloaded' })
    await waitVisible(page.locator('#screen-home'), `${label} comparison screen`)
    await openComments(page)
    return page
}

async function makeSwitchableIdentityContext(browser, origin) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.setExtraHTTPHeaders({ 'x-test-actor': 'alice' })
    await context.route('**/*', (route) => {
        const target = new URL(route.request().url())
        if (target.origin === origin) return route.continue()
        return route.abort('blockedbyclient')
    })
    return {
        context,
        setActor: async (actor) => context.setExtraHTTPHeaders({ 'x-test-actor': actor }),
    }
}

function waitForSignal(promise, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 6000)),
    ])
}

function scopedScreenUrl(origin) {
    const params = new URLSearchParams({
        reportPath,
        screenId: 'screen-home',
        locale: 'en',
        profile: '393x852',
        image: imageAfter,
        side: 'after',
    })
    return `${origin}/screen-data/comments/screen?${params}`
}

async function main() {
    const server = createServer((request, response) => {
        handleRequest(request, response).catch((error) => {
            if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
            response.end('Local integration fixture failed')
            console.error('Local fixture error:', error.message)
        })
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    const origin = `http://127.0.0.1:${address.port}`
    let browser
    const pageErrors = []
    const apiTrace = []
    const behaviorFailures = []
    try {
        const launchOptions = { headless: true }
        if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH
        }
        browser = await chromium.launch(launchOptions)
        const aliceContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            extraHTTPHeaders: { 'x-test-actor': 'alice' },
        })
        await aliceContext.route('**/*', (route) => {
            const target = new URL(route.request().url())
            if (target.origin === origin) return route.continue()
            return route.abort('blockedbyclient')
        })
        const alicePage = await aliceContext.newPage()
        alicePage.on('pageerror', (error) => pageErrors.push(error.message))
        alicePage.on('request', (request) => {
            if (new URL(request.url()).pathname.startsWith('/screen-data/comments/')) {
                apiTrace.push({
                    method: request.method(),
                    path: new URL(request.url()).pathname,
                    body: request.postData(),
                })
            }
        })
        alicePage.on('response', (response) => {
            const path = new URL(response.url()).pathname
            if (path.startsWith('/screen-data/comments/')) {
                apiTrace.push({ status: response.status(), path })
                if (response.request().method() === 'GET' && /\/threads\/[0-9a-f-]+$/i.test(path)) {
                    response
                        .json()
                        .then((value) =>
                            apiTrace.push({
                                detail: path,
                                replies: value.replies?.map((reply) => reply.body),
                                replyCount: value.thread?.replyCount,
                            })
                        )
                        .catch(() => {})
                }
            }
        })
        const reportUrl = `${origin}/screens/${reportRelativePath}/?source=synthetic&locale=en`
        await alicePage.goto(reportUrl, { waitUntil: 'domcontentloaded' })
        await waitVisible(alicePage.locator('#screen-home'), 'comparison screen #screen-home')
        await openComments(alicePage)
        await waitVisible(alicePage.getByLabel('Add a comment'), 'Add a comment composer')
        await alicePage.getByLabel('Add a comment').fill(rootBody)
        await alicePage.getByRole('button', { name: 'Post comment', exact: true }).click()
        const feedItem = alicePage.locator('#comment-feed [data-thread-id]').first()
        try {
            await waitVisible(feedItem, 'new activity excerpt in #comment-feed')
        } catch (error) {
            const panelText = await alicePage
                .locator('#comment-panel')
                .innerText()
                .catch(() => '<panel unavailable>')
            const feedText = await alicePage
                .locator('#comment-feed')
                .innerText()
                .catch(() => '<feed unavailable>')
            console.error(JSON.stringify({ apiTrace, panelText, feedText, pageErrors }, null, 2))
            await alicePage
                .screenshot({ path: '/private/tmp/peanut-comments-browser-failure.png', fullPage: true })
                .catch(() => {})
            throw error
        }
        const threadId = await feedItem.getAttribute('data-thread-id')
        assert.match(threadId ?? '', /^[0-9a-f-]{36}$/i, 'posted thread exposes its UUID')
        assert.match(await feedItem.innerText(), /Browser/, 'latest activity excerpt shows the new comment')
        const { panelThread: thread } = await selectThreadFromFeed(alicePage, threadId, 'new thread')
        const rootComment = thread.locator('[data-comment-id]').filter({ hasText: rootBody }).first()
        await waitVisible(rootComment, 'root comment with data-comment-id')
        const rootCommentId = await rootComment.getAttribute('data-comment-id')
        assert.match(rootCommentId ?? '', /^[0-9a-f-]{36}$/i, 'root comment exposes its UUID')
        const rootBodyNode = rootComment.locator('[data-comment-body]')
        assert.equal(
            await rootBodyNode.evaluate((node) => node.textContent),
            rootBody,
            'body text remains literal, including whitespace and HTML-like text'
        )
        assert.equal(
            await rootBodyNode.locator('b, img').count(),
            0,
            'comment body is rendered as text, not executable markup'
        )

        const badge = alicePage.locator('#screen-home button.comment-count[data-comment-side="after"]')
        await alicePage.waitForFunction((selector) => {
            const button = document.querySelector(selector)
            const count = button?.textContent?.match(/\d+/)?.[0]
            return count !== undefined && Number.parseInt(count, 10) >= 1
        }, '#screen-home button.comment-count[data-comment-side="after"]')

        await thread.getByRole('button', { name: 'Reply', exact: true }).click()
        await waitVisible(alicePage.getByLabel('Reply'), 'Reply composer')
        await alicePage.getByLabel('Reply').fill(replyBody)
        await alicePage.getByRole('button', { name: 'Post reply', exact: true }).click()
        const repliesButton = thread.getByRole('button', { name: /1 repl(y|ies)/i })
        await waitVisible(repliesButton, 'reply count button')
        await repliesButton.click()
        const replyNode = thread.locator('[data-comment-id]').filter({ hasText: replyBody }).first()
        await waitVisible(replyNode, 'expanded reply with data-comment-id')
        assert.equal(await replyNode.locator('[data-comment-body]').textContent(), replyBody)

        const editButton = rootComment.getByRole('button', { name: 'Edit', exact: true })
        await waitVisible(editButton, 'author Edit action')
        await editButton.click()
        await waitVisible(alicePage.getByLabel('Edit comment'), 'Edit comment field')
        await alicePage.getByRole('button', { name: 'Cancel edit', exact: true }).click()
        assert.equal(await rootBodyNode.textContent(), rootBody, 'cancel edit leaves the comment unchanged')
        await rootComment.getByRole('button', { name: 'Edit', exact: true }).click()
        await alicePage.getByLabel('Edit comment').fill(editedBody)
        await alicePage.getByRole('button', { name: 'Save changes', exact: true }).click()
        await alicePage.waitForFunction(
            ({ id, body }) => {
                const comment = document.querySelector(`[data-comment-id="${id}"] [data-comment-body]`)
                return comment?.textContent === body
            },
            { id: rootCommentId, body: editedBody }
        )
        const editedRootComment = thread.locator(`[data-comment-id="${rootCommentId}"]`)
        assert.equal(await editedRootComment.locator('[data-comment-body]').textContent(), editedBody)
        assert.equal(await editedRootComment.locator('[data-comment-body]').locator('img').count(), 0)

        const resolveButton = thread.getByRole('button', { name: 'Resolve thread', exact: true })
        await waitVisible(resolveButton, 'Resolve thread action')
        await resolveButton.click()
        const reopenButton = thread.getByRole('button', { name: 'Reopen thread', exact: true })
        await waitVisible(reopenButton, 'Reopen thread action after resolution')
        await reopenButton.click()
        await waitVisible(
            thread.getByRole('button', { name: 'Resolve thread', exact: true }),
            'Resolve thread action after reopening'
        )

        for (const width of [320, 390, 768, 1024]) {
            await alicePage.setViewportSize({ width, height: 900 })
            const measurements = await alicePage.evaluate(() => {
                const panel = document.querySelector('#zoom #comment-panel')
                const rect = panel?.getBoundingClientRect()
                return {
                    viewportWidth: window.innerWidth,
                    documentWidth: document.documentElement.scrollWidth,
                    panelLeft: rect?.left ?? -1,
                    panelRight: rect?.right ?? Number.POSITIVE_INFINITY,
                }
            })
            assert.ok(
                measurements.documentWidth <= width,
                `page has no horizontal overflow at ${width}px: ${JSON.stringify(measurements)}`
            )
            assert.ok(
                measurements.panelLeft >= 0 && measurements.panelRight <= width,
                `comment panel fits at ${width}px: ${JSON.stringify(measurements)}`
            )
        }

        await alicePage.reload({ waitUntil: 'domcontentloaded' })
        await waitVisible(alicePage.locator('#screen-home'), 'screen after reload')
        await openComments(alicePage)
        const { feedItem: persistedFeedItem, panelThread: persistedThread } = await selectThreadFromFeed(
            alicePage,
            threadId,
            'persisted thread'
        )
        const persistedExcerpt = await persistedFeedItem.innerText()
        assert.match(
            persistedExcerpt,
            /Browser|A reply from Alice|Edited/,
            'feed excerpt reflects a persisted thread activity'
        )
        const persistedRoot = persistedThread.locator(`[data-comment-id="${rootCommentId}"]`)
        await waitVisible(persistedRoot, 'persisted edited root comment')
        assert.equal(await persistedRoot.locator('[data-comment-body]').textContent(), editedBody)
        await persistedThread.getByRole('button', { name: /1 repl(y|ies)/i }).click()
        const persistedReply = persistedThread.locator('[data-comment-id]').filter({ hasText: replyBody }).first()
        try {
            await waitVisible(persistedReply, 'persisted reply after reload')
        } catch (error) {
            const panelText = await alicePage
                .locator('#comment-panel')
                .innerText()
                .catch(() => '<panel unavailable>')
            console.error(
                JSON.stringify(
                    {
                        panelText,
                        apiTrace,
                        persistedThreadText: await persistedThread.innerText().catch(() => '<thread unavailable>'),
                    },
                    null,
                    2
                )
            )
            await alicePage
                .screenshot({ path: '/private/tmp/peanut-comments-browser-reply-reload-failure.png', fullPage: true })
                .catch(() => {})
            throw error
        }

        const bobContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            extraHTTPHeaders: { 'x-test-actor': 'bob' },
        })
        await bobContext.route('**/*', (route) => {
            const target = new URL(route.request().url())
            if (target.origin === origin) return route.continue()
            return route.abort('blockedbyclient')
        })
        const bobPage = await bobContext.newPage()
        bobPage.on('pageerror', (error) => pageErrors.push(error.message))
        await bobPage.goto(reportUrl, { waitUntil: 'domcontentloaded' })
        await waitVisible(bobPage.locator('#screen-home'), 'screen for second synthetic user')
        await openComments(bobPage)
        const { panelThread: bobThread } = await selectThreadFromFeed(
            bobPage,
            threadId,
            'shared thread for second synthetic user'
        )
        assert.equal(
            await bobThread.getByRole('button', { name: 'Edit', exact: true }).count(),
            0,
            "another user cannot edit Alice's root comment"
        )
        await bobContext.close()

        // A response can be lost after the Worker committed the root. Retrying the
        // unchanged composer must replay its request UUID and create only one root.
        const lostResponseBody = 'Lost response retry is still one comment'
        const lostPage = await openReportPage(aliceContext, origin, reportUrl, 'lost-response retry')
        let lostAttempts = []
        let committedResponseStatus
        await lostPage.route('**/screen-data/comments/threads', async (route) => {
            if (route.request().method() !== 'POST') return route.continue()
            const body = JSON.parse(route.request().postData() || '{}')
            lostAttempts.push({ body, actor: (await route.request().allHeaders())['x-test-actor'] })
            if (lostAttempts.length === 1) {
                const committed = await route.fetch()
                committedResponseStatus = committed.status()
                await route.abort('failed')
                return
            }
            await route.continue()
        })
        await lostPage.getByLabel('Add a comment').fill(lostResponseBody)
        await lostPage.getByRole('button', { name: 'Post comment', exact: true }).click()
        await lostPage.waitForTimeout(150)
        assert.equal(committedResponseStatus, 201, 'first lost-response attempt reached the Worker and committed')
        assert.equal(
            await lostPage.getByLabel('Add a comment').inputValue(),
            lostResponseBody,
            'failed response keeps the root draft'
        )
        assert.equal(lostAttempts.length, 1, 'no automatic retry hides the explicit retry behavior')
        const retryResponse = lostPage.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === '/screen-data/comments/threads' &&
                response.request().method() === 'POST'
        )
        await lostPage.getByRole('button', { name: 'Post comment', exact: true }).click()
        const retryResult = await retryResponse
        assert.equal(retryResult.status(), 200, 'second request is acknowledged as an idempotent replay')
        assert.equal(lostAttempts.length, 2)
        assert.equal(lostAttempts[0].actor, 'alice')
        assert.equal(lostAttempts[1].actor, 'alice')
        assert.deepEqual(lostAttempts[1].body, lostAttempts[0].body, 'retry preserves request UUID and payload')
        assert.match(lostAttempts[0].body.requestId, /^[0-9a-f-]{36}$/i)
        const lostListing = await lostPage.evaluate(async (url) => (await fetch(url)).json(), scopedScreenUrl(origin))
        const lostRoots = lostListing.threads.filter((item) => item.comment?.body === lostResponseBody)
        assert.equal(lostRoots.length, 1, 'a committed lost response followed by retry leaves exactly one root')
        const lostThreadId = lostRoots[0].id
        await waitVisible(
            lostPage.locator(`#comment-feed [data-thread-id="${lostThreadId}"]`),
            'retried root in activity feed'
        )

        // A transient authentication failure leaves the exact draft available to
        // the same actor for a deliberate retry.
        const authFailureBody = 'Draft survives a temporary authentication failure'
        const authRetryPage = await openReportPage(aliceContext, origin, reportUrl, 'authentication retry')
        const authAttempts = []
        await authRetryPage.route('**/screen-data/comments/threads', async (route) => {
            if (route.request().method() !== 'POST') return route.continue()
            authAttempts.push({
                body: JSON.parse(route.request().postData() || '{}'),
                actor: (await route.request().allHeaders())['x-test-actor'],
            })
            if (authAttempts.length === 1) {
                await route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'unauthorized' }),
                })
                return
            }
            await route.continue()
        })
        await authRetryPage.getByLabel('Add a comment').fill(authFailureBody)
        await authRetryPage.getByRole('button', { name: 'Post comment', exact: true }).click()
        await authRetryPage.waitForTimeout(100)
        try {
            const draftField = authRetryPage.getByLabel('Add a comment')
            assert.equal(await draftField.isVisible(), true, '401 keeps the root composer available')
            assert.equal(await draftField.inputValue(), authFailureBody, '401 keeps the root draft intact')
            const authRetryResponse = authRetryPage.waitForResponse(
                (response) =>
                    new URL(response.url()).pathname === '/screen-data/comments/threads' &&
                    response.request().method() === 'POST'
            )
            await authRetryPage.getByRole('button', { name: 'Post comment', exact: true }).click()
            assert.equal((await authRetryResponse).status(), 201, 'same actor can retry successfully after 401')
            assert.equal(authAttempts.length, 2)
            assert.deepEqual(
                authAttempts.map((attempt) => attempt.actor),
                ['alice', 'alice']
            )
            assert.equal(authAttempts[0].body.body, authFailureBody)
            assert.equal(authAttempts[1].body.body, authFailureBody)
            const authListing = await authRetryPage.evaluate(
                async (url) => (await fetch(url)).json(),
                scopedScreenUrl(origin)
            )
            assert.equal(authListing.threads.filter((item) => item.comment?.body === authFailureBody).length, 1)
        } catch (error) {
            const panelText = await authRetryPage
                .locator('#comment-panel')
                .innerText()
                .catch(() => '<panel unavailable>')
            const feedText = await authRetryPage
                .locator('#comment-feed')
                .innerText()
                .catch(() => '<feed unavailable>')
            behaviorFailures.push(`401 recovery: ${error.message}`)
            console.error(
                JSON.stringify(
                    { behaviorFailure: behaviorFailures.at(-1), attempts: authAttempts, panelText, feedText },
                    null,
                    2
                )
            )
        }
        await authRetryPage.close()

        // An older Alice feed request may fail after this same tab authenticates
        // Bob. Its late 401 must not sign Bob back out or erase his composer.
        const late401Identity = await makeSwitchableIdentityContext(browser, origin)
        const late401Page = await openReportPage(
            late401Identity.context,
            origin,
            reportUrl,
            'late-auth-response identity switch'
        )
        let holdAliceFeed = false
        let releaseAliceFeedCapture
        const aliceFeedCaptured = new Promise((resolveCapture) => {
            releaseAliceFeedCapture = resolveCapture
        })
        let delayedAliceFeed
        await late401Page.route('**/screen-data/comments/feed**', async (route) => {
            const headers = await route.request().allHeaders()
            if (holdAliceFeed && headers['x-test-actor'] === 'alice' && !delayedAliceFeed) {
                delayedAliceFeed = route
                releaseAliceFeedCapture()
                return
            }
            await route.continue()
        })
        holdAliceFeed = true
        await late401Page.evaluate(() => window.dispatchEvent(new Event('focus')))
        await waitForSignal(aliceFeedCaptured, 'an in-flight Alice feed request')
        assert.equal((await delayedAliceFeed.request().allHeaders())['x-test-actor'], 'alice')
        await late401Identity.setActor('bob')
        const bobIdentityResponse = late401Page.waitForResponse((response) => {
            const path = new URL(response.url()).pathname
            return path.endsWith('/me') && response.request().headers()['x-test-actor'] === 'bob'
        })
        const bobFeedResponse = late401Page.waitForResponse((response) => {
            return (
                new URL(response.url()).pathname.endsWith('/feed') &&
                response.status() === 200 &&
                response.request().headers()['x-test-actor'] === 'bob'
            )
        })
        await late401Page.evaluate(() => window.dispatchEvent(new Event('focus')))
        assert.equal((await (await bobIdentityResponse).json()).user.email, 'bob@peanut.me')
        await bobFeedResponse
        await waitVisible(
            late401Page.locator('#comment-panel').getByLabel('Add a comment'),
            'Bob composer before stale Alice response'
        )
        await delayedAliceFeed.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'unauthorized' }),
        })
        await waitVisible(
            late401Page.locator('#comment-panel').getByLabel('Add a comment'),
            'Bob composer after stale Alice response settles'
        )
        const bobComposerVisibleAfterLate401 = await late401Page
            .locator('#comment-panel')
            .getByLabel('Add a comment')
            .isVisible()
        if (!bobComposerVisibleAfterLate401) {
            console.error(
                JSON.stringify(
                    {
                        late401Panel: await late401Page
                            .locator('#comment-panel')
                            .innerText()
                            .catch(() => '<panel unavailable>'),
                        late401Feed: await late401Page
                            .locator('#comment-feed')
                            .innerText()
                            .catch(() => '<feed unavailable>'),
                        late401DialogVisible: await late401Page
                            .locator('#zoom')
                            .isVisible()
                            .catch(() => false),
                        late401ComposerCount: await late401Page
                            .locator('#comment-panel [aria-label="Add a comment"]')
                            .count()
                            .catch(() => -1),
                    },
                    null,
                    2
                )
            )
            await late401Page
                .screenshot({
                    path: resolve(screenshotDirectory, 'peanut-comments-browser-late-401.png'),
                    fullPage: true,
                })
                .catch(() => {})
        }
        assert.equal(bobComposerVisibleAfterLate401, true, "late Alice 401 does not remove Bob's signed-in composer")
        assert.doesNotMatch(
            await late401Page.locator('#comment-feed').innerText(),
            /Sign in to view/,
            "late Alice 401 cannot replace Bob's feed with a signed-out state"
        )
        await late401Identity.context.close()

        // A focus reauthentication that confirms Bob can overlap Alice's visible
        // draft and an in-flight Bob feed. The old private draft must disappear
        // before any subsequent submit can carry it under Bob's identity.
        const draftSwitchIdentity = await makeSwitchableIdentityContext(browser, origin)
        const draftSwitchPage = await openReportPage(
            draftSwitchIdentity.context,
            origin,
            reportUrl,
            'draft identity switch'
        )
        const alicePrivateDraft = 'Alice private draft must never be posted as Bob'
        await draftSwitchPage.getByLabel('Add a comment').fill(alicePrivateDraft)
        const attemptedPosts = []
        draftSwitchPage.on('request', (request) => {
            if (new URL(request.url()).pathname === '/screen-data/comments/threads' && request.method() === 'POST') {
                attemptedPosts.push({
                    actor: request.headers()['x-test-actor'],
                    body: JSON.parse(request.postData() || '{}'),
                })
            }
        })
        let holdBobFeed = false
        let releaseBobFeedCapture
        const bobFeedCaptured = new Promise((resolveCapture) => {
            releaseBobFeedCapture = resolveCapture
        })
        let delayedBobFeed
        await draftSwitchPage.route('**/screen-data/comments/feed**', async (route) => {
            const headers = await route.request().allHeaders()
            if (holdBobFeed && headers['x-test-actor'] === 'bob' && !delayedBobFeed) {
                delayedBobFeed = route
                releaseBobFeedCapture()
                return
            }
            await route.continue()
        })
        holdBobFeed = true
        await draftSwitchIdentity.setActor('bob')
        const verifiedBobResponse = draftSwitchPage.waitForResponse((response) => {
            const path = new URL(response.url()).pathname
            return path.endsWith('/me') && response.request().headers()['x-test-actor'] === 'bob'
        })
        await draftSwitchPage.evaluate(() => window.dispatchEvent(new Event('focus')))
        assert.equal((await (await verifiedBobResponse).json()).user.email, 'bob@peanut.me')
        await waitForSignal(bobFeedCaptured, 'Bob feed request after his identity was verified')
        const panelAfterSwitch = draftSwitchPage.locator('#comment-panel')
        assert.doesNotMatch(
            await panelAfterSwitch.innerText(),
            new RegExp(alicePrivateDraft),
            'Alice private draft is cleared when the actual actor changes to Bob'
        )
        const draftValues = await panelAfterSwitch
            .locator('textarea')
            .evaluateAll((nodes) => nodes.map((node) => node.value))
        assert.equal(
            draftValues.includes(alicePrivateDraft),
            false,
            "no hidden or visible Bob textarea retains Alice's draft"
        )
        const switchedComposer = draftSwitchPage.getByLabel('Add a comment')
        if (await switchedComposer.isVisible().catch(() => false)) {
            assert.notEqual(
                await switchedComposer.inputValue(),
                alicePrivateDraft,
                "Bob composer cannot inherit Alice's draft"
            )
            await draftSwitchPage.getByRole('button', { name: 'Post comment', exact: true }).click()
        }
        await draftSwitchPage.waitForTimeout(150)
        assert.equal(
            attemptedPosts.some((attempt) => attempt.actor === 'bob' && attempt.body.body === alicePrivateDraft),
            false,
            "no submit during Bob's delayed feed request posts Alice's draft as Bob"
        )
        await delayedBobFeed.continue()
        await draftSwitchIdentity.context.close()

        // A successful POST begun in an old panel generation must not consume a
        // newer draft entered after navigating away and reopening the panel.
        const lateSavePage = await openReportPage(aliceContext, origin, reportUrl, 'late-save panel generation')
        const firstInFlightBody = 'First in-flight message'
        const newerPanelDraft = 'New draft written after returning'
        let committedLateSaveStatus
        let notifyLateSaveCommitted
        const lateSaveCommitted = new Promise((resolveCommit) => {
            notifyLateSaveCommitted = resolveCommit
        })
        let releaseLateSaveResponse
        const lateSaveResponseGate = new Promise((resolveRelease) => {
            releaseLateSaveResponse = resolveRelease
        })
        let lateSaveAttempts = 0
        await lateSavePage.route('**/screen-data/comments/threads', async (route) => {
            if (route.request().method() !== 'POST' || lateSaveAttempts > 0) return route.continue()
            lateSaveAttempts += 1
            const committed = await route.fetch()
            committedLateSaveStatus = committed.status()
            notifyLateSaveCommitted()
            await lateSaveResponseGate
            await route.fulfill({
                status: committed.status(),
                headers: committed.headers(),
                body: await committed.body(),
            })
        })
        await lateSavePage.getByLabel('Add a comment').fill(firstInFlightBody)
        const firstSaveResponse = lateSavePage.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === '/screen-data/comments/threads' &&
                response.request().method() === 'POST'
        )
        await lateSavePage.getByRole('button', { name: 'Post comment', exact: true }).click()
        await waitForSignal(lateSaveCommitted, 'the first comment POST to commit')
        assert.equal(committedLateSaveStatus, 201, 'first in-flight save committed before its response was released')
        await lateSavePage.keyboard.press('Escape')
        await lateSavePage.locator('#zoom').waitFor({ state: 'hidden', timeout: 5000 })
        await openComments(lateSavePage)
        await lateSavePage.getByLabel('Add a comment').fill(newerPanelDraft)
        releaseLateSaveResponse()
        assert.equal((await firstSaveResponse).status(), 201)
        assert.equal(
            await lateSavePage.getByLabel('Add a comment').inputValue(),
            newerPanelDraft,
            'older successful save cannot clear a newer draft after panel navigation'
        )
        const lateSaveListing = await lateSavePage.evaluate(
            async (url) => (await fetch(url)).json(),
            scopedScreenUrl(origin)
        )
        assert.equal(
            lateSaveListing.threads.filter((item) => item.comment?.body === firstInFlightBody).length,
            1,
            'the committed first save remains exactly once while the newer draft stays local'
        )
        await lateSavePage.close()

        // Startup context loading can overlap navigation to a comment permalink.
        // Release both auth responses and require the authenticated feed to load
        // instead of leaving the activity region blank.
        const concurrentAuthPage = await openReportPage(
            aliceContext,
            origin,
            reportUrl,
            'concurrent startup authentication'
        )
        const authRoutes = []
        let signalFirstAuth
        const firstAuthCaptured = new Promise((resolveCapture) => {
            signalFirstAuth = resolveCapture
        })
        let signalSecondAuth
        const secondAuthCaptured = new Promise((resolveCapture) => {
            signalSecondAuth = resolveCapture
        })
        const authResponseReleases = []
        let passThroughAuth = false
        await concurrentAuthPage.route('**/screen-data/comments/me', async (route) => {
            if (passThroughAuth || authRoutes.length >= 2) return route.continue()
            let releaseHandler
            const held = new Promise((resolveRelease) => {
                releaseHandler = resolveRelease
            })
            const index = authRoutes.length
            authRoutes.push(route)
            authResponseReleases[index] = async () => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        user: { id: 'alice@peanut.me', email: 'alice@peanut.me', name: 'Alice' },
                    }),
                })
                releaseHandler()
            }
            if (index === 0) signalFirstAuth()
            if (index === 1) signalSecondAuth()
            await held
        })
        const raceFeedRequests = []
        concurrentAuthPage.on('request', (request) => {
            if (new URL(request.url()).pathname.endsWith('/feed')) raceFeedRequests.push(request)
        })
        const raceFeedResponse = concurrentAuthPage.waitForResponse(
            (response) => new URL(response.url()).pathname.endsWith('/feed') && response.status() === 200
        )
        await concurrentAuthPage.evaluate((selectedThreadId) => {
            const feed = document.createElement('div')
            const panel = document.createElement('div')
            const dialog = document.createElement('dialog')
            feed.id = 'auth-concurrency-feed'
            panel.id = 'auth-concurrency-panel'
            dialog.id = 'auth-concurrency-dialog'
            document.body.append(feed, panel, dialog)
            const client = window.ScreenComments.create({ feed, panel, dialog, onNavigate() {} })
            window.__commentsAuthRace = {
                client,
                contextPromise: client.setContext(),
                navigatePromise: client.navigateThread(selectedThreadId),
            }
        }, threadId)
        await waitForSignal(firstAuthCaptured, 'startup setContext authentication')
        await Promise.race([secondAuthCaptured, new Promise((resolveDelay) => setTimeout(resolveDelay, 200))])
        console.log(`Auth-concurrency fixture held ${authRoutes.length} /me request(s).`)
        passThroughAuth = true
        for (const release of authResponseReleases.filter(Boolean)) await release()
        await concurrentAuthPage.evaluate(async () => {
            await Promise.all([window.__commentsAuthRace.contextPromise, window.__commentsAuthRace.navigatePromise])
        })
        console.log(
            `Auth-concurrency fixture completed both operations; feed requests so far: ${raceFeedRequests.length}.`
        )
        const authRaceScope = {
            reportPath,
            screenId: 'screen-home',
            name: 'Home',
            locale: 'en',
            profile: '393x852',
            image: imageAfter,
            side: 'after',
        }
        await concurrentAuthPage.evaluate((scope) => window.__commentsAuthRace.client.open(scope), authRaceScope)
        console.log(`Auth-concurrency fixture called open(); feed requests observed: ${raceFeedRequests.length}.`)
        await raceFeedResponse
        assert.ok(
            raceFeedRequests.length >= 1,
            'overlapping startup and permalink authentication still issue a feed request'
        )
        assert.notEqual(
            await concurrentAuthPage.locator('#auth-concurrency-feed').innerText(),
            '',
            'authenticated activity feed does not remain blank after concurrent authentication'
        )
        await concurrentAuthPage.close()

        // Two tabs render the same version. A write in the second makes the first
        // tab stale; its rejected edit must remain editable for recovery.
        const staleView = await openReportPage(aliceContext, origin, reportUrl, 'stale edit tab')
        const { panelThread: staleThread } = await selectThreadFromFeed(staleView, threadId, 'stale edit thread')
        const staleRoot = staleThread.locator(`[data-comment-id="${rootCommentId}"]`)
        await waitVisible(staleRoot, 'root in stale tab')
        const concurrentEditBody = 'Updated in a second tab'
        const updater = await openReportPage(aliceContext, origin, reportUrl, 'concurrent edit tab')
        const { panelThread: updaterThread } = await selectThreadFromFeed(updater, threadId, 'concurrent edit thread')
        const updaterRoot = updaterThread.locator(`[data-comment-id="${rootCommentId}"]`)
        await updaterRoot.getByRole('button', { name: 'Edit', exact: true }).click()
        await updater.getByLabel('Edit comment').fill(concurrentEditBody)
        await updater.getByRole('button', { name: 'Save changes', exact: true }).click()
        await updater.waitForFunction(
            ({ id, body }) =>
                document.querySelector(`[data-comment-id="${id}"] [data-comment-body]`)?.textContent === body,
            { id: rootCommentId, body: concurrentEditBody }
        )

        const staleDraft = 'Keep this draft after a stale-version conflict'
        await staleRoot.getByRole('button', { name: 'Edit', exact: true }).click()
        await staleView.getByLabel('Edit comment').fill(staleDraft)
        const staleSaveResponse = staleView.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === `/screen-data/comments/comments/${rootCommentId}` &&
                response.request().method() === 'PATCH'
        )
        await staleView.getByRole('button', { name: 'Save changes', exact: true }).click()
        assert.equal((await staleSaveResponse).status(), 409, 'stale tab edit is rejected as a conflict')
        assert.equal(
            await staleView.getByLabel('Edit comment').inputValue(),
            staleDraft,
            '409 keeps the rejected edit draft for recovery'
        )

        await staleView.setViewportSize({ width: 1280, height: 900 })
        await staleView.screenshot({
            path: resolve(screenshotDirectory, 'peanut-comments-browser-desktop.png'),
            fullPage: true,
        })
        await staleView.setViewportSize({ width: 320, height: 900 })
        await staleView.screenshot({
            path: resolve(screenshotDirectory, 'peanut-comments-browser-mobile-320.png'),
            fullPage: true,
        })
        console.log(
            `Populated browser screenshots: ${resolve(screenshotDirectory, 'peanut-comments-browser-desktop.png')} and ${resolve(screenshotDirectory, 'peanut-comments-browser-mobile-320.png')}`
        )
        await updater.close()
        await staleView.close()
        await lostPage.close()
        await aliceContext.close()

        assert.deepEqual(behaviorFailures, [], `behavioral recovery failures: ${behaviorFailures.join('; ')}`)
        assert.deepEqual(pageErrors, [], `browser runtime errors: ${pageErrors.join('; ')}`)
        console.log(
            'Comments browser integration passed: create, badge/feed, reply, edit/cancel, resolve/reopen, literal text, reload persistence, ownership, lost-response idempotent retry, 401 draft retention, both identity switches, late-save draft preservation, concurrent startup/permalink auth, stale-edit recovery, populated screenshots, and 320/390/768/1024 widths.'
        )
    } finally {
        if (browser) await browser.close()
        await new Promise((resolveClose) => server.close(resolveClose))
        db.close()
    }
}

main().catch((error) => {
    console.error(error.stack ?? error)
    process.exitCode = 1
})
