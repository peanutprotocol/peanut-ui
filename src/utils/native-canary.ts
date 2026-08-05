// One-shot startup probe for the direct (un-proxied) WebView fetch path the
// app relies on once CapacitorHttp is disabled (PEANUT-UI-R44). Reports the
// outcome to Sentry so we can watch CORS + credential behavior across real
// tester devices and networks before and after the transport switch.
// Query: message:"direct-fetch canary" — tags: outcome, transport.

import * as Sentry from '@sentry/nextjs'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { isCapacitor } from './capacitor'

const CANARY_TIMEOUT_MS = 10_000

let scheduled = false

export function scheduleDirectFetchCanary(delayMs: number = 4_000): void {
    if (!isCapacitor() || scheduled || typeof window === 'undefined') return
    scheduled = true
    setTimeout(() => {
        void runCanary()
    }, delayMs)
}

async function runCanary(): Promise<void> {
    // CapacitorWebFetch is the original WebView fetch the bridge saves before
    // patching; present only while CapacitorHttp is enabled. Its absence means
    // window.fetch is already direct.
    const capWebFetch = (window as unknown as { CapacitorWebFetch?: typeof fetch }).CapacitorWebFetch
    const transport = capWebFetch ? 'cap-web-fetch' : 'window-fetch'
    const doFetch = (capWebFetch ?? window.fetch).bind(window)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CANARY_TIMEOUT_MS)
    const startedAt = Date.now()
    let outcome: string
    try {
        const response = await doFetch(`${PEANUT_API_URL}/users/me`, {
            method: 'GET',
            credentials: 'include',
            signal: controller.signal,
        })
        outcome = `http-${response.status}`
    } catch (error) {
        outcome = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network-error'
    } finally {
        clearTimeout(timeoutId)
    }

    Sentry.captureMessage('direct-fetch canary', {
        level: 'info',
        tags: { canary: 'direct-fetch', outcome, transport },
        extra: { durationMs: Date.now() - startedAt },
    })
}
