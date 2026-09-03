'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi, RainCardRateLimitError, type RainCardDetailsResponse } from '@/services/rain'

interface UseCardRevealArgs {
    cardId: string
    /** Auto-mask after this many ms once revealed. 0 disables. */
    autoMaskMs?: number
}

interface UseCardRevealResult {
    revealed: RainCardDetailsResponse | null
    isLoading: boolean
    error: string | null
    isRateLimited: boolean
    reveal: () => Promise<void>
    hide: () => void
    toggle: () => Promise<void>
}

const DEFAULT_AUTO_MASK_MS = 30_000

/**
 * Fetches a card's PAN/CVV/expiry from the backend and holds it in memory
 * with a safety auto-mask on timeout so secrets don't linger on screen.
 * While the page is hidden the secrets are COVERED, not cleared: iOS and
 * Android snapshot the backgrounded webview for the task switcher, so the
 * PAN must not be painted then — but on native, switching to the merchant
 * app to paste the number is the whole point, and clearing meant the user
 * came back to a masked card and a rate-limited re-reveal. Not masked on
 * blur: native fires it spuriously. Never persist the revealed payload —
 * let it be recomputed on the next reveal.
 */
export function useCardReveal({ cardId, autoMaskMs = DEFAULT_AUTO_MASK_MS }: UseCardRevealArgs): UseCardRevealResult {
    const [revealed, setRevealed] = useState<RainCardDetailsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isRateLimited, setIsRateLimited] = useState(false)
    // ponytail: a JS cover races the OS snapshot; FLAG_SECURE / an iOS privacy
    // overlay is the upgrade if a device check ever catches the PAN in recents.
    const [obscured, setObscured] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const hide = useCallback(() => {
        setRevealed(null)
        setError(null)
        setIsRateLimited(false)
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
    }, [])

    const reveal = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        setIsRateLimited(false)
        posthog.capture(ANALYTICS_EVENTS.CARD_PAN_REVEAL_ATTEMPTED)
        try {
            const data = await rainApi.getCardDetails(cardId)
            setRevealed(data)
            posthog.capture(ANALYTICS_EVENTS.CARD_PAN_REVEALED)
            if (autoMaskMs > 0) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current)
                timeoutRef.current = setTimeout(() => {
                    setRevealed(null)
                    timeoutRef.current = null
                }, autoMaskMs)
            }
        } catch (e) {
            if (e instanceof RainCardRateLimitError) {
                setIsRateLimited(true)
                setError(e.message)
                posthog.capture(ANALYTICS_EVENTS.CARD_PAN_RATE_LIMITED)
            } else {
                // Never surface the raw error to the UI: the backend forwards
                // internal/upstream detail in its message (e.g. a raw Rain 500
                // body), and CardFace renders the error string verbatim on the
                // card. Show a friendly, actionable message instead.
                setError('Could not load card details. Please try again or contact support.')
                // Telemetry gets a bounded slice for segmenting failures — not the
                // full message, to keep raw upstream error bodies out of client
                // analytics. The complete, sanitized detail is already in Sentry
                // via fetchWithSentry.
                const errorMessage = e instanceof Error ? e.message : 'Failed to load card details'
                posthog.capture(ANALYTICS_EVENTS.CARD_PAN_FAILED, { error_message: errorMessage.slice(0, 120) })
            }
        } finally {
            setIsLoading(false)
        }
    }, [cardId, autoMaskMs])

    const toggle = useCallback(async () => {
        if (revealed) {
            hide()
            return
        }
        await reveal()
    }, [revealed, hide, reveal])

    useEffect(() => {
        const sync = () => setObscured(document.visibilityState === 'hidden')
        document.addEventListener('visibilitychange', sync)
        return () => {
            document.removeEventListener('visibilitychange', sync)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    return { revealed: obscured ? null : revealed, isLoading, error, isRateLimited, reveal, hide, toggle }
}
