'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { pollUntilApplyAdvances, pollUntilReady } from '@/components/Card/cardApply.utils'
import { cardConsentDocuments } from '@/services/consent'
import { rainApi } from '@/services/rain'
import {
    applyFailureOf,
    cardChainStateFromFailure,
    cardChainStateFromResponse,
    type CardChainState,
} from '@/utils/one-shot-card.utils'

/**
 * The card step of one-shot onboarding (TASK-23329, item 9b): the four card
 * questions, the cardholder agreements, `POST /rain/cards`.
 *
 * It is the card page's apply chain (`useCardFlow`) cut down to what runs
 * beside the identity check: the same route, the same readiness poll after
 * the questions, the same consent echo on acceptance. Nothing here reads a
 * rail; the drawer row does that. `chain` is the route's last answer, mapped.
 */
export function useOneShotCardChain() {
    const t = useTranslations('card')
    const [chain, setChain] = useState<CardChainState | null>(null)
    // the SDK token of the card questions, or of a missing identity step
    const [token, setToken] = useState<string | null>(null)
    // the agreements show as soon as the route asks for them; the user can
    // put them aside and come back from the card row
    const [showTerms, setShowTerms] = useState(false)
    const [isBusy, setIsBusy] = useState(false)
    const chainRef = useRef<CardChainState | null>(null)

    const follow = useCallback((next: CardChainState) => {
        chainRef.current = next
        setChain(next)
        setToken(next.kind === 'questions' || next.kind === 'identity-step' ? next.token : null)
        setShowTerms(next.kind === 'agreements')
    }, [])

    const apply = useCallback(
        async (opts: Parameters<typeof rainApi.applyForCard>[0]) => {
            setIsBusy(true)
            try {
                const res = await rainApi.applyForCard(opts)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status, source: 'one-shot' })
                follow(cardChainStateFromResponse(res))
            } catch (error) {
                const failure = applyFailureOf(error)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, {
                    error_message: failure.message,
                    code: failure.code,
                    source: 'one-shot',
                })
                follow(cardChainStateFromFailure(failure))
            } finally {
                setIsBusy(false)
            }
        },
        [follow]
    )

    /** Ask the route where the card stands and follow its answer (a token opens the SDK). */
    const start = useCallback(() => apply({ termsAccepted: false }), [apply])

    /** The user comes back to an open step: the agreements they put aside, or the route's answer again. */
    const resume = useCallback(() => {
        if (chainRef.current?.kind === 'agreements') {
            setShowTerms(true)
            return Promise.resolve()
        }
        return start()
    }, [start])

    const dismissTerms = useCallback(() => setShowTerms(false), [])

    const acceptTerms = useCallback(async () => {
        const isUsResident = chainRef.current?.kind === 'agreements' && chainRef.current.isUsResident
        posthog.capture(ANALYTICS_EVENTS.CARD_TERMS_ACCEPTED, { is_us_resident: isUsResident, source: 'one-shot' })
        // the consent echo: the documents the screen showed, with version and hash
        await apply({ termsAccepted: true, acceptedDocuments: cardConsentDocuments(isUsResident) })
    }, [apply])

    // one poll at a time; a close or an unmount ends it
    const pollAbortRef = useRef<AbortController | null>(null)
    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            pollAbortRef.current?.abort()
        }
    }, [])

    /**
     * The SDK closed on a submission. After the questions, wait for the
     * readiness stamp the action's review writes, then ask the route again:
     * it answers the agreements, or `pending-identity` when they are already
     * accepted. After a missing identity step there is no stamp to wait for
     * (only the card action's review writes it): ask the route again, which
     * reads the documents on file, with a short grace while Sumsub still
     * records the upload.
     */
    const handleSdkComplete = useCallback(async () => {
        const closing = chainRef.current?.kind
        setToken(null)
        pollAbortRef.current?.abort()
        const controller = new AbortController()
        pollAbortRef.current = controller
        setIsBusy(true)
        const slow = () => follow({ kind: 'error', message: t('page.verificationSlow') })
        try {
            if (closing === 'identity-step') {
                let res = await rainApi.applyForCard({ termsAccepted: false })
                for (let attempt = 0; attempt < 3 && res.status === 'main-kyc-required'; attempt++) {
                    await new Promise((resolve) => setTimeout(resolve, 1500))
                    if (controller.signal.aborted) return
                    res = await rainApi.applyForCard({ termsAccepted: false })
                }
                if (controller.signal.aborted) return
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status, source: 'one-shot' })
                return follow(cardChainStateFromResponse(res))
            }
            const ready = await pollUntilReady({
                fetchReadiness: () => rainApi.getCardApplyReadiness(),
                intervalMs: 1000,
                timeoutMs: 30000,
                signal: controller.signal,
            })
            if (controller.signal.aborted) return
            if (!ready) return slow()
            const res = await pollUntilApplyAdvances({
                fetchApply: () => rainApi.applyForCard({ termsAccepted: false }),
                intervalMs: 1000,
                timeoutMs: 5000,
                signal: controller.signal,
            })
            if (controller.signal.aborted) return
            if (!res) return slow()
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status, source: 'one-shot' })
            follow(cardChainStateFromResponse(res))
        } catch (error) {
            if (controller.signal.aborted) return
            follow(cardChainStateFromFailure(applyFailureOf(error)))
        } finally {
            if (mountedRef.current && pollAbortRef.current === controller) setIsBusy(false)
        }
    }, [follow, t])

    /** The user left the SDK without finishing: the step stays open for the row and the Home card. */
    const handleSdkClose = useCallback(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_CLOSED, { source: 'one-shot' })
        setToken(null)
    }, [])

    const refreshToken = useCallback(async (): Promise<string> => {
        const res = await rainApi.applyForCard({ termsAccepted: false })
        const next = cardChainStateFromResponse(res)
        if (next.kind === 'questions' || next.kind === 'identity-step') {
            setToken(next.token)
            return next.token
        }
        // the step moved on while the SDK was open: close it and follow
        follow(next)
        return ''
    }, [follow])

    const reset = useCallback(() => {
        pollAbortRef.current?.abort()
        chainRef.current = null
        setChain(null)
        setToken(null)
        setShowTerms(false)
        setIsBusy(false)
    }, [])

    return {
        chain,
        token,
        showTerms,
        isBusy,
        /** the SDK or the agreements are on screen: the setup drawer steps aside */
        isForeground: !!token || (showTerms && chain?.kind === 'agreements'),
        start,
        resume,
        acceptTerms,
        dismissTerms,
        handleSdkComplete,
        handleSdkClose,
        refreshToken,
        reset,
    }
}

export type OneShotCardChain = ReturnType<typeof useOneShotCardChain>
