import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../../public/screen-library/comments.js', import.meta.url), 'utf8')
class Element extends EventTarget {
    children = []
    dataset = {}
    classList = { add() {} }
    append(...children) {
        this.children.push(...children)
    }
    replaceChildren(...children) {
        this.children = children
    }
    get firstChild() {
        return this.children[0]
    }
    get lastChild() {
        return this.children.at(-1)
    }
    querySelector(selector) {
        return this.children.find((child) => child.className === selector.slice(1))
    }
    querySelectorAll() {
        return []
    }
    setAttribute() {}
}

function row(id) {
    return {
        id: String(id),
        createdAt: new Date(id * 1000).toISOString(),
        threadId: String(id),
        body: `Comment ${id}`,
        author: { name: 'Author' },
        scope: { name: 'Home', locale: 'en', side: 'after' },
    }
}

async function mount() {
    let now = 0
    const tasks = new Map()
    const requests = []
    const flush = async () => {
        for (let i = 0; i < 12; i++) await Promise.resolve()
    }
    const tick = async (ms) => {
        const end = now + ms
        for (;;) {
            const task = [...tasks].sort(([, a], [, b]) => a.at - b.at)[0]
            if (!task || task[1].at > end) break
            tasks.delete(task[0])
            now = task[1].at
            task[1].callback()
            await flush()
        }
        now = end
        await flush()
    }
    const activity = new Element()
    activity.open = false
    const feed = new Element()
    const panel = new Element()
    const document = Object.assign(new EventTarget(), {
        visibilityState: 'visible',
        createElement: () => new Element(),
    })
    const window = new EventTarget()
    vm.runInNewContext(source, {
        window,
        document,
        URLSearchParams,
        AbortController,
        location: { pathname: '/screens/', search: '', hash: '' },
        setTimeout(callback, ms) {
            const key = Symbol()
            tasks.set(key, { callback, at: now + ms })
            return key
        },
        clearTimeout(key) {
            tasks.delete(key)
        },
        fetch(url, { signal }) {
            return new Promise((resolve, reject) => {
                const response = (body, status = 200) =>
                    resolve({
                        status,
                        ok: status === 200,
                        headers: { get: () => 'application/json' },
                        json: () => body,
                    })
                requests.push({ url, response, reject, signal })
                if (url.endsWith('/me')) response({ user: { id: 'author' } })
                signal.addEventListener('abort', () => reject(new Error('Aborted')))
            })
        },
    })
    const comments = window.ScreenComments.create({ activity, feed, panel, dialog: new Element() })
    const feeds = () => requests.filter(({ url }) => url.includes('/feed?'))
    const last = () => feeds().at(-1)
    const ids = () => feed.children.flatMap((child) => (child.dataset.commentId ? [child.dataset.commentId] : []))
    const context = comments.setContext({ prNumber: 42 })
    await flush()
    last().response({ items: [row(3), row(2)], nextCursor: 'old' })
    await context
    return {
        feed,
        panel,
        window,
        comments,
        feeds,
        last,
        tick,
        flush,
        ids,
        open(open) {
            activity.open = open
            activity.dispatchEvent(new Event('toggle'))
        },
        visible(visible) {
            document.visibilityState = visible ? 'visible' : 'hidden'
            document.dispatchEvent(new Event('visibilitychange'))
        },
    }
}

test('activity refresh runs once on reopening and on visibility recovery, and stops while inactive', async () => {
    const h = await mount()
    await h.tick(60_000)
    assert.equal(h.feeds().length, 1)
    h.open(true)
    assert.equal(h.feeds().length, 2)
    h.last().response({ items: [row(3), row(2)], nextCursor: 'old' })
    await h.tick(29_999)
    assert.equal(h.feeds().length, 2)
    await h.tick(1)
    assert.equal(h.feeds().length, 3)
    h.last().response({ items: [row(3), row(2)], nextCursor: 'old' })
    h.open(false)
    await h.tick(60_000)
    assert.equal(h.feeds().length, 3)
    h.open(true)
    assert.equal(h.feeds().length, 4)
    h.last().response({ items: [row(3), row(2)], nextCursor: 'old' })
    h.visible(false)
    await h.tick(60_000)
    assert.equal(h.feeds().length, 4)
    h.visible(true)
    assert.equal(h.feeds().length, 5)
})

test('a transient poll failure retains older rows, their cursor, and the draft UI', async () => {
    const h = await mount()
    const draft = new Element()
    draft.value = 'Draft in progress'
    h.panel.append(draft)
    h.feed.querySelector('.comment-more').onclick()
    h.last().response({ items: [row(1)], nextCursor: 'older' })
    await h.flush()
    h.open(true)
    h.last().response({ items: [row(4), row(3)], nextCursor: 'new' })
    await h.flush()
    assert.deepEqual(h.ids(), ['4', '3', '2', '1'])
    const retainedNodes = h.feed.children
    await h.tick(30_000)
    h.last().reject(new Error('Connection lost'))
    await h.flush()
    assert.equal(h.feed.children, retainedNodes)
    assert.equal(h.panel.firstChild, draft)
    assert.equal(draft.value, 'Draft in progress')
    h.feed.querySelector('.comment-more').onclick()
    assert.match(h.last().url, /cursor=older/)
})

test('manual refresh queues behind a poll, and a real 401 halts polling until sign-in', async () => {
    const h = await mount()
    h.open(true)
    h.feed.querySelector('.comment-feed-heading').lastChild.onclick()
    assert.equal(h.feeds().length, 2)
    h.last().response({ items: [row(3), row(2)], nextCursor: 'old' })
    await h.flush()
    assert.equal(h.feeds().length, 3)
    h.last().response({ error: 'unauthorized' }, 401)
    await h.flush()
    assert.match(h.feed.firstChild.textContent, /Sign in/)
    await h.tick(90_000)
    assert.equal(h.feeds().length, 3)
    h.window.dispatchEvent(new Event('focus'))
    await h.flush()
    assert.equal(h.feeds().length, 4)
    h.last().response({ items: [row(3)] })
    await h.flush()
    assert.deepEqual(h.ids(), ['3'])
})

test('a report change cancels an obsolete read and starts a request for the new report', async () => {
    const h = await mount()
    h.open(true)
    const obsolete = h.last()
    const newContext = h.comments.setContext({ prNumber: 43 })
    await h.flush()
    assert.equal(obsolete.signal.aborted, true)
    assert.match(h.last().url, /pr=43/)
    h.last().response({ items: [row(10)] })
    await newContext
    assert.deepEqual(h.ids(), ['10'])
})

test('new arrivals do not grow the feed until older pages are requested, and a gap restarts pagination', async () => {
    const h = await mount()
    const page = (start) => Array.from({ length: 30 }, (_, i) => row(start - i))
    h.open(true)
    h.last().response({ items: page(60), nextCursor: '61-page' })
    await h.tick(30_000)
    h.last().response({ items: page(61), nextCursor: '62-page' })
    await h.tick(30_000)
    h.last().response({ items: page(62), nextCursor: 'old' })
    await h.flush()
    assert.deepEqual(
        h.ids(),
        page(62).map(({ id }) => id)
    )

    h.feed.querySelector('.comment-more').onclick()
    h.last().response({ items: page(32), nextCursor: 'older' })
    await h.tick(30_000)
    h.last().response({ items: page(64), nextCursor: 'gap' })
    await h.flush()
    assert.deepEqual(
        h.ids(),
        [...page(64), ...page(32)].map(({ id }) => id)
    )
    h.feed.querySelector('.comment-more').onclick()
    assert.match(h.last().url, /cursor=gap/)
    h.last().response({ items: page(34), nextCursor: 'filled' })
    await h.flush()
    assert.deepEqual(
        h.ids(),
        [...page(64), ...page(34), row(4), row(3)].map(({ id }) => id)
    )
})

test('More activity queues once behind a poll and does not queue another append during pagination', async () => {
    const h = await mount()
    h.open(true)
    const more = h.feed.querySelector('.comment-more')
    more.onclick()
    more.onclick()
    assert.equal(h.feeds().length, 2)
    h.last().response({ items: [row(4), row(3)], nextCursor: 'fresh' })
    await h.flush()
    assert.equal(h.feeds().length, 3)
    assert.match(h.last().url, /cursor=fresh/)
    more.onclick()
    h.last().response({ items: [row(2), row(1)], nextCursor: 'older' })
    await h.flush()
    assert.equal(h.feeds().length, 3)
    assert.deepEqual(h.ids(), ['4', '3', '2', '1'])
})
