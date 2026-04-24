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
 * with a safety auto-mask: hides on timeout, tab blur, and page unload so
 * secrets don't linger on screen. Never persist the revealed payload — let
 * it be recomputed on the next reveal.
 */
export function useCardReveal({ cardId, autoMaskMs = DEFAULT_AUTO_MASK_MS }: UseCardRevealArgs): UseCardRevealResult {
    const [revealed, setRevealed] = useState<RainCardDetailsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isRateLimited, setIsRateLimited] = useState(false)
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
                const message = e instanceof Error ? e.message : 'Failed to load card details'
                setError(message)
                posthog.capture(ANALYTICS_EVENTS.CARD_PAN_FAILED, { error_message: message })
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

    // Auto-mask when the user switches tabs or the window loses focus — a
    // bystander who glances at an unattended screen shouldn't see secrets.
    useEffect(() => {
        if (!revealed) return
        const onHide = () => setRevealed(null)
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') setRevealed(null)
        }
        window.addEventListener('blur', onHide)
        window.addEventListener('pagehide', onHide)
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            window.removeEventListener('blur', onHide)
            window.removeEventListener('pagehide', onHide)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [revealed])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    return { revealed, isLoading, error, isRateLimited, reveal, hide, toggle }
}
