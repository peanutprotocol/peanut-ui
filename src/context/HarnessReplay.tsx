'use client'

/**
 * HarnessReplay — Path B client-side interpreter for the QA harness action DSL.
 *
 * After `ReproduceBootstrap` restores the persistent state (DB snapshot +
 * localStorage + jwt cookie) and hard-reloads, this component drives the UI
 * through the captured user actions — click this button, type that amount,
 * wait for this text — so the user lands at the EXACT transient state the
 * screenshot captured (mid-flow amounts, post-submit receipts, etc.).
 *
 * Action descriptors are defined server-side in
 * `engineering/qa/lib/action-dsl.mjs`. Both interpreters (server-side
 * Playwright in the runner, and this client-side DOM driver) consume the same
 * JSON. If you add an action type, update both.
 *
 * Handshake with ReproduceBootstrap:
 *   - Bootstrap stashes the accumulated `stepActions` from the manifest into
 *     sessionStorage under HARNESS_REPLAY_ACTIONS_KEY before reloading.
 *   - This component reads + clears on next mount, so the replay fires
 *     exactly once and re-renders don't retrigger it.
 *
 * Not active outside sandbox mode — keyed off the same env flag
 * `NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK` ReproduceBootstrap uses.
 */

import { useEffect } from 'react'

export const HARNESS_REPLAY_ACTIONS_KEY = '__harness_replay_actions'
// Cursor persists across page navigations so an action list that spans
// multiple Next.js routes (goto /home → click → goto /withdraw → click) can
// resume after each navigation's component re-mount. Cleared on completion.
const HARNESS_REPLAY_INDEX_KEY = '__harness_replay_index'

type Action =
    | { type: 'goto'; url: string }
    | { type: 'wait'; ms: number }
    | { type: 'click-role'; role: 'button' | 'link' | 'textbox'; name: string; timeoutMs?: number }
    | { type: 'click-text'; text: string; timeoutMs?: number }
    | { type: 'fill-amount'; value: string; perKeyDelayMs?: number }
    | { type: 'fill'; selector: string; value: string }
    | { type: 'wait-for-text'; text: string; timeoutMs?: number }
    | { type: 'wait-for-selector'; selector: string; timeoutMs?: number }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Poll every 100ms until cb() returns truthy or timeout. */
async function waitFor<T>(cb: () => T | null | undefined, timeoutMs: number, label: string): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const v = cb()
        if (v) return v
        await sleep(100)
    }
    throw new Error(`[harness-replay] timeout waiting for ${label} after ${timeoutMs}ms`)
}

/**
 * Compute an accessible-name-ish string for an element. Approximates the
 * `@testing-library/dom` computation: aria-label wins, then descendant text
 * excluding aria-hidden subtrees, then fallback to textContent.
 */
function accessibleName(el: HTMLElement): string {
    const aria = el.getAttribute('aria-label')
    if (aria) return aria.trim()
    // Walk descendants and concatenate their text, skipping aria-hidden or
    // role=presentation subtrees, and skipping SVG content (always decorative
    // unless it has role=img with a title — rare in this app).
    const parts: string[] = []
    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const t = (node.textContent || '').trim()
            if (t) parts.push(t)
            return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return
        const e = node as HTMLElement
        if (e.getAttribute('aria-hidden') === 'true') return
        if (e.getAttribute('role') === 'presentation') return
        if (e.tagName === 'SVG' || e.tagName === 'svg') return
        for (const child of Array.from(e.childNodes)) walk(child)
    }
    walk(el)
    return parts.join(' ').trim()
}

/** Match `button` / `link` / `textbox` whose accessible name matches. */
function findByRole(role: Action extends { type: 'click-role'; role: infer R } ? R : never, nameRegex: RegExp): HTMLElement | null {
    const selectors: Record<string, string> = {
        button: 'button, [role="button"], input[type="button"], input[type="submit"]',
        link: 'a, [role="link"]',
        textbox: 'input:not([type="button"]):not([type="submit"]), textarea, [role="textbox"]',
    }
    const sel = selectors[role] || selectors.button
    // Drop anchors so /^\s*withdraw\s*$/ also matches "↑ Withdraw" (symbol prefix).
    const relaxed = new RegExp(nameRegex.source.replace(/^\^/, '').replace(/\$$/, ''), nameRegex.flags)
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(sel))
    for (const el of candidates) {
        if (!isVisible(el)) continue
        if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue
        const name = accessibleName(el)
        if (!name) continue
        const cleaned = name.replace(/[^\p{L}\p{N}\p{P}\s]/gu, '').trim()
        if (nameRegex.test(name) || nameRegex.test(cleaned) || relaxed.test(cleaned)) return el
    }
    return null
}

/** Log visible candidate elements for a role when a match fails. Helps
 * diagnose selector flakes without cracking open devtools. */
function logCandidates(role: string) {
    const selectors: Record<string, string> = {
        button: 'button, [role="button"], input[type="button"], input[type="submit"]',
        link: 'a, [role="link"]',
        textbox: 'input, textarea, [role="textbox"]',
    }
    const sel = selectors[role] || selectors.button
    const allButtons = Array.from(document.querySelectorAll<HTMLElement>(sel))
    const visible = allButtons.filter(isVisible)
    console.warn(
        `[harness-replay] ${role}s — total in DOM: ${allButtons.length}, visible: ${visible.length}` +
        `, url=${location.pathname}${location.search}` +
        `, bodyText.length=${(document.body.innerText || '').length}`
    )
    console.warn(`[harness-replay] visible ${role}s:`, visible.map((el) => ({
        tag: el.tagName.toLowerCase(),
        name: accessibleName(el).slice(0, 60),
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
    })))
    console.warn(`[harness-replay] body tail: ${(document.body.innerText || '').slice(-200).replace(/\s+/g, ' ')}`)
}

/** Match first VISIBLE element whose textContent matches `textRegex`. */
function findByText(textRegex: RegExp): HTMLElement | null {
    // Treewalk for performance — stops at first hit, avoids touching <script>/<style>.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
            const el = n as HTMLElement
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        },
    })
    let node = walker.nextNode() as HTMLElement | null
    while (node) {
        if (isVisible(node)) {
            const ownText = Array.from(node.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => (n.textContent || '').trim())
                .join(' ')
                .trim()
            if (ownText && textRegex.test(ownText)) return node
        }
        node = walker.nextNode() as HTMLElement | null
    }
    return null
}

function isVisible(el: HTMLElement): boolean {
    if (!el.isConnected) return false
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return false
    const s = window.getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
}

/**
 * Set an input's value in a way React's controlled-input onChange hears.
 * React tracks a private `_valueTracker` on DOM inputs; bypassing its setter
 * makes React ignore the change. Using the NATIVE HTMLInputElement setter
 * + dispatching an `input` event triggers React's synthetic event flow.
 */
function setNativeInputValue(input: HTMLInputElement, value: string) {
    const proto = Object.getPrototypeOf(input)
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
    if (desc?.set) {
        desc.set.call(input, value)
    } else {
        input.value = value
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function runAction(a: Action): Promise<void> {
    switch (a.type) {
        case 'goto': {
            // Skip when we're already on the target path — the gallery
            // aligns ReproduceBootstrap's entry with the first goto URL, so
            // this first action is a no-op. Re-navigating would tear down +
            // re-mount for no reason and churn an extra grace period.
            if (location.pathname === a.url || location.pathname + location.search === a.url) {
                return
            }
            // Full navigation — `location.assign` triggers Next.js to fetch
            // + mount the target route with effects firing naturally. The
            // subsequent HarnessReplay re-mount picks up the action queue
            // from sessionStorage using HARNESS_REPLAY_INDEX_KEY so replay
            // resumes from the next action after the goto.
            window.location.assign(a.url)
            // Suspend the loop — this promise never resolves because the
            // page is being torn down. The new page's HarnessReplay will
            // continue from index+1.
            await new Promise(() => {})
            return
        }
        case 'wait':
            await sleep(a.ms)
            return
        case 'click-role': {
            const re = new RegExp(a.name, 'i')
            const timeout = a.timeoutMs ?? 20000
            let el: HTMLElement | null = null
            try {
                el = await waitFor(() => findByRole(a.role, re), timeout, `role=${a.role} name=${a.name}`)
            } catch (err) {
                logCandidates(a.role)
                throw err
            }
            // Dispatch a real mouse click via mousedown/mouseup/click sequence so
            // any synthetic-event-filtering React handlers actually fire.
            el.scrollIntoView({ block: 'center', inline: 'center' })
            await sleep(100)
            el.click()
            return
        }
        case 'click-text': {
            const re = new RegExp(a.text, 'i')
            const timeout = a.timeoutMs ?? 15000
            const el = await waitFor(() => findByText(re), timeout, `text ${a.text}`)
            // Click the nearest interactive ancestor if the element itself
            // isn't a button — text often lives inside a wrapper div that
            // has the click handler.
            const target = (el.closest('button, a, [role="button"], [role="link"]') || el) as HTMLElement
            target.scrollIntoView({ block: 'center', inline: 'center' })
            await sleep(100)
            target.click()
            return
        }
        case 'fill-amount': {
            // The AmountInput mounts + unmounts a few times during the
            // WithdrawFlowContext step-transition. Re-query inside the typing
            // loop so we don't hold a stale node reference.
            const timeout = 20000
            const getInput = () => {
                const nodes = Array.from(document.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'))
                // Pick the visible one; there may be multiple during transitions.
                return nodes.find((n) => isVisible(n)) || null
            }
            let input = await waitFor<HTMLInputElement>(getInput, timeout, 'AmountInput (input[inputmode="decimal"])')
            input.focus()
            setNativeInputValue(input, '')
            await sleep(100)
            const delay = a.perKeyDelayMs ?? 50
            let accum = ''
            for (const ch of String(a.value)) {
                accum += ch
                input = getInput() || input // refresh in case React unmounted
                input.focus()
                setNativeInputValue(input, accum)
                await sleep(delay)
            }
            // Blur so the UI's onBlur validators commit before the next click.
            input.blur()
            await sleep(100)
            return
        }
        case 'fill': {
            const input = await waitFor<HTMLInputElement>(
                () => document.querySelector<HTMLInputElement>(a.selector),
                10000,
                a.selector
            )
            input.focus()
            setNativeInputValue(input, String(a.value))
            return
        }
        case 'wait-for-text': {
            const re = new RegExp(a.text, 'i')
            await waitFor(() => findByText(re), a.timeoutMs ?? 60000, `text ${a.text}`)
            return
        }
        case 'wait-for-selector': {
            await waitFor(
                () => document.querySelector<HTMLElement>(a.selector),
                a.timeoutMs ?? 30000,
                a.selector
            )
            return
        }
        default:
            // exhaustiveness
            throw new Error(`[harness-replay] unknown action type`)
    }
}

// Per-document guard: block React strict-mode's double useEffect from
// starting two parallel loops WITHIN the same page. Cleared implicitly on
// navigation because the module re-evaluates. Cross-page resumption is
// handled separately by HARNESS_REPLAY_INDEX_KEY in sessionStorage.
let inFlightThisDocument = false

export function HarnessReplay() {
    useEffect(() => {
        // Only active in sandbox / harness mode — same env guard as ReproduceBootstrap.
        if (process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK !== 'true') return
        // Crisp chat widget mounts an embedded /crisp-proxy route that runs
        // the full ClientProviders tree inside an iframe/tab. That second
        // mount would otherwise fire a parallel replay loop against an empty
        // body, racing the real page's loop. Bail on non-user-visible routes.
        if (typeof location !== 'undefined' && location.pathname.startsWith('/crisp-proxy')) return
        if (inFlightThisDocument) return
        inFlightThisDocument = true

        const raw = sessionStorage.getItem(HARNESS_REPLAY_ACTIONS_KEY)
        if (!raw) return
        let actions: Action[]
        try {
            actions = JSON.parse(raw)
        } catch {
            sessionStorage.removeItem(HARNESS_REPLAY_ACTIONS_KEY)
            sessionStorage.removeItem(HARNESS_REPLAY_INDEX_KEY)
            return
        }
        if (!Array.isArray(actions) || actions.length === 0) {
            sessionStorage.removeItem(HARNESS_REPLAY_ACTIONS_KEY)
            sessionStorage.removeItem(HARNESS_REPLAY_INDEX_KEY)
            return
        }

        // Resume from the persisted cursor. Zero on first run; advances past
        // each completed action. Survives goto→page-reload so a multi-route
        // action sequence resumes after each Next.js navigation.
        const startIdx = Math.max(0, parseInt(sessionStorage.getItem(HARNESS_REPLAY_INDEX_KEY) || '0', 10)) || 0
        if (startIdx >= actions.length) {
            sessionStorage.removeItem(HARNESS_REPLAY_ACTIONS_KEY)
            sessionStorage.removeItem(HARNESS_REPLAY_INDEX_KEY)
            return
        }

        // Grace period for providers (auth, kernel, TanStack) to stabilize.
        // Initial mount is shorter (ReproduceBootstrap already reloaded for us);
        // resume-after-goto is longer because Next.js dev may be compiling the
        // freshly-visited route on first hit.
        const grace = startIdx === 0 ? 1500 : 2500
        let cancelled = false
        ;(async () => {
            await sleep(grace)
            if (cancelled) return
            console.log(`[harness-replay] ${startIdx === 0 ? 'starting' : `resuming at ${startIdx}`} — ${actions.length} actions`)
            for (let i = startIdx; i < actions.length; i++) {
                if (cancelled) return
                const a = actions[i]
                try {
                    console.log(`[harness-replay] ${i + 1}/${actions.length}: ${a.type}`, a)
                    // Persist AFTER-this-action index before running so goto
                    // (which tears down the page) resumes at the next action.
                    sessionStorage.setItem(HARNESS_REPLAY_INDEX_KEY, String(i + 1))
                    await runAction(a)
                } catch (err) {
                    console.warn(`[harness-replay] action ${i + 1} failed (continuing):`, err)
                }
            }
            console.log(`[harness-replay] done`)
            sessionStorage.removeItem(HARNESS_REPLAY_ACTIONS_KEY)
            sessionStorage.removeItem(HARNESS_REPLAY_INDEX_KEY)
        })()

        return () => { cancelled = true }
    }, [])

    return null
}
