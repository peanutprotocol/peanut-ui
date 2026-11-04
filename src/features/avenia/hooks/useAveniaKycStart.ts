'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { aveniaApi } from '@/services/avenia'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { markAveniaUnavailable } from '@/features/avenia/aveniaAvailability'
import { IN_APP_BROWSER_CLOSED_EVENT, isNativeBridge, openExternalUrl } from '@/utils/capacitor'
import { reserveDetachedTab } from '@/utils/reserved-tab'

/** Re-arm cadence for the user poller, under its 30 s window (same as useWaitingOnProviderModal). */
const REARM_INTERVAL_MS = 20_000

export interface AveniaKycStart {
    /** Call straight out of a click: on the web it reserves the tab inside the gesture. */
    start: () => Promise<void>
    isStarting: boolean
    /** The hosted page was opened, or Avenia is reviewing: the screen waits for the rail. */
    isWaiting: boolean
    /** Localized flow-level failure; null when there is none. */
    error: string | null
}

/**
 * First use of Avenia Pix: POST /avenia/kyc/start creates the user's Avenia
 * sub-account once and answers with Avenia's hosted KYC page. The app opens
 * it, then waits for the AVENIA × PIX_BR rail the way it waits for a Bridge
 * review: the user query refetches every few seconds while the screen is
 * open, and the rail push from the KYC webhook refreshes it at once.
 *
 * A 403 means Avenia is not open to this user (the rollout gate, or a Peanut
 * verification still to do), and a 404 an API without the Avenia routes: in
 * both cases the user keeps the Manteca flow this session.
 */
export function useAveniaKycStart({ railEnabled }: { railEnabled: boolean }): AveniaKycStart {
    const t = useTranslations('avenia')
    const { user, fetchUser } = useAuth()
    const userId = user?.user?.userId
    const [isStarting, setIsStarting] = useState(false)
    const [isWaiting, setIsWaiting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // A fast second tap must not open a second Avenia tab before the disable lands.
    const startingRef = useRef(false)

    const refresh = useCallback(() => {
        markSubmitted()
        void fetchUser().catch(() => undefined)
    }, [fetchUser])

    const start = useCallback(async () => {
        if (startingRef.current) return
        startingRef.current = true
        const native = isNativeBridge()
        // Reserved synchronously: a window.open after the await is no longer a user gesture.
        const reservedTab = native ? null : reserveDetachedTab()
        setError(null)
        setIsStarting(true)
        try {
            const started = await aveniaApi.startKyc()
            if (started.state === 'kyc' && started.kycUrl) {
                if (native) await openExternalUrl(started.kycUrl)
                else if (reservedTab && !reservedTab.closed) reservedTab.location.href = started.kycUrl
                else window.location.href = started.kycUrl
                setIsWaiting(true)
                markSubmitted()
                return
            }
            reservedTab?.close()
            // enabled or rejected: the rail already says so; pending: Avenia reviews an imported identity
            if (started.state === 'pending') setIsWaiting(true)
            refresh()
        } catch (caught) {
            reservedTab?.close()
            const code = wireErrorCode(caught)
            // a 404 is an API without the Avenia routes: the Manteca flow still serves the user
            if (
                code === API_ERROR_CODES.AVENIA_NOT_AVAILABLE ||
                code === API_ERROR_CODES.AVENIA_KYC_REQUIRED ||
                apiErrorStatus(caught) === 404
            ) {
                if (userId) markAveniaUnavailable(userId)
                return
            }
            if (code === API_ERROR_CODES.AVENIA_CPF_REQUIRED) setError(t('setup.cpfRequired'))
            else if (apiErrorStatus(caught) === 409) setError(t('setup.settingUp'))
            else setError(t('unavailable'))
        } finally {
            setIsStarting(false)
            startingRef.current = false
        }
    }, [refresh, t, userId])

    // Keep the user poller alive while the rail is still waiting on Avenia.
    useEffect(() => {
        if (!isWaiting || railEnabled) return
        const id = setInterval(() => markSubmitted(), REARM_INTERVAL_MS)
        return () => clearInterval(id)
    }, [isWaiting, railEnabled])

    // Coming back from Avenia's page is the moment the result most likely changed.
    useEffect(() => {
        if (!isWaiting) return
        if (isNativeBridge()) {
            document.addEventListener(IN_APP_BROWSER_CLOSED_EVENT, refresh)
            return () => document.removeEventListener(IN_APP_BROWSER_CLOSED_EVENT, refresh)
        }
        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [isWaiting, refresh])

    return { start, isStarting, isWaiting, error }
}
