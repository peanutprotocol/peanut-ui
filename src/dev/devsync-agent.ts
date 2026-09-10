/**
 * devsync agent - Milestone 1
 *
 * Runs inside each harness iframe. Import once, as early as possible, behind
 * DEV_TOOLS_ENABLED. No-ops when not inside a harness pane, so it is safe to
 * call unconditionally behind that gate.
 *
 *   if (DEV_TOOLS_ENABLED) {
 *     import('@/dev/devsync-agent').then((m) => m.initDevsyncAgent())
 *   }
 */

const CHANNEL = 'devsync'

type ToHarness =
    | { t: 'ready'; pane: string; w: number; h: number }
    | { t: 'log'; pane: string; level: 'error' | 'warn'; text: string }
    | { t: 'overflow'; pane: string; hits: { sel: string; overhang: number }[] }
    | { t: 'measured'; pane: string; sel: string; px: number | null; pct: number | null }

// Peer-to-peer: agents hear each other directly on the channel and mirror
// state so every pane behaves like a clone. `from` is the self-filter. The
// harness also listens to `route` to keep its path bar in sync.
type Peer =
    | { t: 'hover'; from: string; sel: string }
    | { t: 'route'; from: string; path: string }
    | { t: 'scroll'; from: string; sel: string | null; ratio: number }
    | { t: 'input'; from: string; sel: string; value: string }
    | { t: 'click'; from: string; sel: string }

type FromHarness = { t: 'navigate'; path: string } | { t: 'scan' } | { t: 'clear' } | { t: 'reload' }

/** window.name survives every navigation. frameElement is the same-origin fallback. */
function resolvePaneId(): string | null {
    if (typeof window === 'undefined') return null
    if (window.name?.startsWith('pane:')) return window.name.slice(5)
    try {
        const el = window.frameElement as HTMLElement | null
        return el?.dataset?.pane ?? null
    } catch {
        return null
    }
}

/**
 * Build a selector that has a decent chance of resolving in a sibling pane.
 * data-testid first, because it is stable across breakpoints. nth-of-type path
 * as a fallback, which will miss whenever the DOM branches per breakpoint.
 * Missing is fine. Guessing is not.
 */
function selectorFor(el: Element): string {
    const testid = el.getAttribute('data-testid')
    if (testid) return `[data-testid="${CSS.escape(testid)}"]`

    if (el.id) return `#${CSS.escape(el.id)}`

    const parts: string[] = []
    let node: Element | null = el
    while (node && node !== document.body && parts.length < 12) {
        const parent: Element | null = node.parentElement
        if (!parent) break
        const tag = node.tagName.toLowerCase()
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName)
        parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag)
        node = parent
    }
    return `body > ${parts.join(' > ')}`
}

function viewportWidth(): number {
    return document.documentElement.clientWidth
}

export function initDevsyncAgent(): void {
    const maybePane = resolvePaneId()
    if (!maybePane) return
    // rebind so hoisted function declarations below see `string`, not `string | null`
    const pane: string = maybePane

    const bc = new BroadcastChannel(CHANNEL)
    const send = (m: ToHarness | Peer) => bc.postMessage(m)

    // ---- identity + route reporting -------------------------------------
    // Heartbeat: the harness remounts panes that go silent (e.g. a pane that
    // landed on a connection-refused error page has no agent at all).
    send({ t: 'ready', pane, w: viewportWidth(), h: window.innerHeight })
    window.setInterval(() => send({ t: 'ready', pane, w: viewportWidth(), h: window.innerHeight }), 3000)

    let lastPath = location.pathname + location.search
    let routeTimer: number | undefined
    // Debounced: nuqs writes query params per keystroke via replaceState, and
    // followers hard-load - broadcast once the URL settles, not per keystroke.
    const reportRoute = () => {
        window.clearTimeout(routeTimer)
        routeTimer = window.setTimeout(() => {
            const p = location.pathname + location.search
            if (p === lastPath) return
            lastPath = p
            send({ t: 'route', from: pane, path: p })
        }, 300)
    }
    // Covers both history API navigation and back/forward.
    for (const k of ['pushState', 'replaceState'] as const) {
        const orig = history[k]
        history[k] = function (this: History, ...args: Parameters<History['pushState']>) {
            const r = orig.apply(this, args)
            queueMicrotask(reportRoute)
            return r
        }
    }
    window.addEventListener('popstate', reportRoute)

    // ---- error aggregation ----------------------------------------------
    const origError = console.error.bind(console)
    console.error = (...args: unknown[]) => {
        send({ t: 'log', pane, level: 'error', text: args.map(String).join(' ').slice(0, 400) })
        origError(...args)
    }
    window.addEventListener('error', (e) => {
        send({ t: 'log', pane, level: 'error', text: `${e.message} (${e.filename}:${e.lineno})` })
    })
    window.addEventListener('unhandledrejection', (e) => {
        send({ t: 'log', pane, level: 'error', text: `unhandled rejection: ${String(e.reason)}` })
    })

    // ---- overflow detection ---------------------------------------------
    const OUTLINE_ATTR = 'data-devsync-overflow'
    function clearOutlines() {
        document.querySelectorAll(`[${OUTLINE_ATTR}]`).forEach((el) => {
            ;(el as HTMLElement).style.outline = ''
            el.removeAttribute(OUTLINE_ATTR)
        })
    }
    function scanOverflow() {
        clearOutlines()
        const vw = viewportWidth()
        const hits: { sel: string; overhang: number }[] = []
        // If the document itself does not scroll horizontally, every apparent
        // overhang is clipped by some ancestor and is not a page-scroll bug.
        if (document.documentElement.scrollWidth <= vw + 1) {
            send({ t: 'overflow', pane, hits })
            return
        }
        document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) return
            const overhang = Math.max(Math.round(r.right - vw), Math.round(-r.left))
            if (overhang <= 1) return
            // Skip display:none and position:fixed - fixed elements never scroll the page.
            if (el.offsetParent === null) return
            el.style.outline = '2px solid #e5484d'
            el.setAttribute(OUTLINE_ATTR, '')
            hits.push({ sel: selectorFor(el), overhang })
        })
        hits.sort((a, b) => b.overhang - a.overhang)
        send({ t: 'overflow', pane, hits: hits.slice(0, 20) })
    }

    // ---- measure overlay --------------------------------------------------
    let highlighted: HTMLElement | null = null
    function highlight(el: HTMLElement | null) {
        if (highlighted) highlighted.style.boxShadow = ''
        highlighted = el
        if (el) el.style.boxShadow = 'inset 0 0 0 1px #2680eb'
    }
    function measure(sel: string) {
        let el: HTMLElement | null = null
        try {
            el = document.querySelector<HTMLElement>(sel)
        } catch {
            el = null
        }
        if (!el) {
            highlight(null)
            send({ t: 'measured', pane, sel, px: null, pct: null })
            return
        }
        highlight(el)
        const px = Math.round(el.getBoundingClientRect().width)
        send({ t: 'measured', pane, sel, px, pct: Math.round((px / viewportWidth()) * 100) })
    }

    let hoverTimer: number | undefined
    document.addEventListener(
        'mouseover',
        (e) => {
            const el = e.target as HTMLElement
            if (!el || el === document.body) return
            window.clearTimeout(hoverTimer)
            // Debounced so a mouse crossing the pane does not spam the channel.
            hoverTimer = window.setTimeout(() => {
                const sel = selectorFor(el)
                send({ t: 'hover', from: pane, sel })
                measure(sel)
            }, 60)
        },
        { passive: true }
    )

    // ---- clone sync: scroll + form input ----------------------------------
    // Capture-phase listener sees scrolls of inner containers too (scroll
    // does not bubble, but it does capture). Ratio-based so panes of
    // different heights land on the same content.
    let lastRemoteScroll = 0
    document.addEventListener(
        'scroll',
        (e) => {
            if (Date.now() - lastRemoteScroll < 250) return
            const isDoc = e.target === document
            const el = isDoc ? document.documentElement : (e.target as HTMLElement)
            const max = el.scrollHeight - el.clientHeight
            if (max <= 0) return
            send({ t: 'scroll', from: pane, sel: isDoc ? null : selectorFor(el), ratio: el.scrollTop / max })
        },
        { capture: true, passive: true }
    )
    function applyScroll(sel: string | null, ratio: number) {
        let el: HTMLElement | null = document.documentElement
        if (sel) {
            try {
                el = document.querySelector<HTMLElement>(sel)
            } catch {
                el = null
            }
        }
        if (!el) return
        lastRemoteScroll = Date.now()
        el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
    }

    let applyingInput = false
    document.addEventListener(
        'input',
        (e) => {
            if (applyingInput) return
            const el = e.target as HTMLInputElement | null
            if (!el || typeof el.value !== 'string') return
            send({ t: 'input', from: pane, sel: selectorFor(el), value: el.value })
        },
        true
    )
    function applyInput(sel: string, value: string) {
        let el: HTMLElement | null = null
        try {
            el = document.querySelector<HTMLElement>(sel)
        } catch {
            el = null
        }
        if (!el) return
        const proto =
            el instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : el instanceof HTMLSelectElement
                  ? HTMLSelectElement.prototype
                  : el instanceof HTMLInputElement
                    ? HTMLInputElement.prototype
                    : null
        if (!proto) return
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
        if (!setter) return
        // React ignores plain .value writes - go through the native setter,
        // then dispatch input/change so controlled components pick it up.
        applyingInput = true
        setter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        applyingInput = false
    }

    // ---- clone sync: clicks -----------------------------------------------
    // Mirrors real user clicks so useState-driven UI (modals, drawers, camera
    // steps) opens in every pane, not just the routed screens. WARNING: this
    // also means mutating actions fire once per pane - fine against the local
    // sandbox backend, never point this at prod.
    let applyingClick = false
    document.addEventListener(
        'click',
        (e) => {
            // isTrusted filters out both our own synthetic clicks and any the app fires
            if (applyingClick || !e.isTrusted) return
            const el = e.target instanceof Element ? e.target : null
            if (!el) return
            send({ t: 'click', from: pane, sel: selectorFor(el) })
        },
        true
    )
    function applyClick(sel: string) {
        let el: HTMLElement | null = null
        try {
            el = document.querySelector<HTMLElement>(sel)
        } catch {
            el = null
        }
        if (!el) return
        applyingClick = true
        el.click()
        applyingClick = false
    }

    // ---- route following ----------------------------------------------------
    // Deterministic per-pane stagger: click-sync usually SPA-navigates a pane
    // on its own, and 6 simultaneous hard loads can overwhelm the dev server
    // (the "localhost refused to connect" panes). Delay, then re-check.
    const followDelay = 200 + (Array.from(pane).reduce((a, c) => a + c.charCodeAt(0), 0) % 5) * 250
    let followTimer: number | undefined
    function followRoute(path: string) {
        window.clearTimeout(followTimer)
        followTimer = window.setTimeout(() => {
            if (location.pathname + location.search !== path) location.href = path
        }, followDelay)
    }

    // ---- inbound ----------------------------------------------------------
    bc.onmessage = (e: MessageEvent<FromHarness | Peer>) => {
        const m = e.data
        if (m.t === 'navigate') {
            if (location.pathname + location.search !== m.path) location.href = m.path
        } else if (m.t === 'route') {
            // follow a peer's navigation (staggered hard load; no-op if click
            // sync already SPA-navigated this pane there).
            if (m.from !== pane) followRoute(m.path)
        } else if (m.t === 'scroll') {
            if (m.from !== pane) applyScroll(m.sel, m.ratio)
        } else if (m.t === 'input') {
            if (m.from !== pane) applyInput(m.sel, m.value)
        } else if (m.t === 'click') {
            if (m.from !== pane) applyClick(m.sel)
        } else if (m.t === 'scan') {
            scanOverflow()
        } else if (m.t === 'hover') {
            if (m.from !== pane) measure(m.sel)
        } else if (m.t === 'clear') {
            clearOutlines()
            highlight(null)
        } else if (m.t === 'reload') {
            location.reload()
        }
    }

    window.addEventListener('pagehide', () => bc.close())
}
