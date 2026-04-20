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

/** Match `button` or `[role=button]` (etc.) whose accessible name matches `nameRegex`. */
function findByRole(role: Action extends { type: 'click-role'; role: infer R } ? R : never, nameRegex: RegExp): HTMLElement | null {
    const selectors: Record<string, string> = {
        button: 'button, [role="button"]',
        link: 'a, [role="link"]',
        textbox: 'input, textarea, [role="textbox"]',
    }
    const sel = selectors[role] || selectors.button
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(sel))
    for (const el of candidates) {
        if (!isVisible(el)) continue
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
        if (nameRegex.test(name)) return el
    }
    return null
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
            // Same-app SPA nav. Use Next.js router if available (faster);
            // fallback to window.location for cross-entry navs.
            // router isn't accessible outside a component context; use
            // a popstate dispatch to let the app router observe the change.
            window.history.pushState({}, '', a.url)
            window.dispatchEvent(new PopStateEvent('popstate'))
            // Grace period for the route component to mount + its effects to fire.
            await sleep(400)
            return
        }
        case 'wait':
            await sleep(a.ms)
            return
        case 'click-role': {
            const re = new RegExp(a.name, 'i')
            const el = await waitFor(() => findByRole(a.role, re), a.timeoutMs ?? 10000, `role=${a.role} name=${a.name}`)
            el.click()
            return
        }
        case 'click-text': {
            const re = new RegExp(a.text, 'i')
            const el = await waitFor(() => findByText(re), a.timeoutMs ?? 10000, `text ${a.text}`)
            // Click the nearest interactive ancestor if the element itself
            // isn't a button — text often lives inside a wrapper div that
            // has the click handler.
            const target = (el.closest('button, a, [role="button"], [role="link"]') || el) as HTMLElement
            target.click()
            return
        }
        case 'fill-amount': {
            const input = await waitFor<HTMLInputElement>(
                () => document.querySelector<HTMLInputElement>('input[inputmode="decimal"]'),
                10000,
                'AmountInput (input[inputmode="decimal"])'
            )
            input.focus()
            // Clear then type char-by-char so per-keystroke validation runs.
            setNativeInputValue(input, '')
            await sleep(50)
            const delay = a.perKeyDelayMs ?? 50
            let accum = ''
            for (const ch of String(a.value)) {
                accum += ch
                setNativeInputValue(input, accum)
                await sleep(delay)
            }
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

export function HarnessReplay() {
    useEffect(() => {
        // Only active in sandbox / harness mode — same env guard as ReproduceBootstrap.
        if (process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK !== 'true') return

        const raw = sessionStorage.getItem(HARNESS_REPLAY_ACTIONS_KEY)
        if (!raw) return

        let actions: Action[]
        try {
            actions = JSON.parse(raw)
        } catch {
            sessionStorage.removeItem(HARNESS_REPLAY_ACTIONS_KEY)
            return
        }
        if (!Array.isArray(actions) || actions.length === 0) {
            sessionStorage.removeItem(HARNESS_REPLAY_ACTIONS_KEY)
            return
        }

        // Clear IMMEDIATELY so re-renders / React strict-mode double-mounts
        // don't re-fire the replay.
        sessionStorage.removeItem(HARNESS_REPLAY_ACTIONS_KEY)

        // Grace period for providers to stabilize: auth, kernel client, etc.
        // Without this, the first click can race an empty DOM.
        const grace = 1500
        let cancelled = false
        ;(async () => {
            await sleep(grace)
            if (cancelled) return
            console.log(`[harness-replay] starting — ${actions.length} actions`)
            for (let i = 0; i < actions.length; i++) {
                if (cancelled) return
                const a = actions[i]
                try {
                    console.log(`[harness-replay] ${i + 1}/${actions.length}: ${a.type}`, a)
                    await runAction(a)
                } catch (err) {
                    console.warn(`[harness-replay] action ${i + 1} failed (continuing):`, err)
                }
            }
            console.log(`[harness-replay] done`)
        })()

        return () => {
            cancelled = true
        }
    }, [])

    return null
}
