'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { aveniaApi } from '@/services/avenia'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { IN_APP_BROWSER_CLOSED_EVENT, isNativeBridge, openExternalUrl } from '@/utils/capacitor'
import { reserveDetachedTab } from '@/utils/reserved-tab'
import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'

/** Re-arm cadence for the user poller, under its 30 s window (same as useWaitingOnProviderModal). */
const REARM_INTERVAL_MS = 20_000

export interface AveniaKycStart {
    /**
     * Call straight out of the control under Avenia's named and linked terms ("By continuing,
     * you agree to…"): the request carries the user's acceptance. On the web it reserves the
     * tab inside the gesture.
     */
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
 * A 403 `ROUTE_NOT_AVAILABLE` means the backend's route moved since the
 * screen loaded: the capabilities are read again, and the route says what
 * the user sees now.
 */
export function useAveniaKycStart({ railEnabled }: { railEnabled: boolean }): AveniaKycStart {
    const t = useTranslations('avenia')
    const { fetchUser } = useAuth()
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
            const started = await aveniaApi.startKyc({ termsAccepted: true })
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
            if (code === API_ERROR_CODES.ROUTE_NOT_AVAILABLE) {
                refresh()
                return
            }
            // a schema 400: the acceptance did not reach the ledger, so nothing started
            if (apiErrorStatus(caught) === 400) setError(t('setup.termsNotSaved'))
            else if (code === API_ERROR_CODES.AVENIA_CPF_REQUIRED) setError(t('setup.cpfRequired'))
            else if (apiErrorStatus(caught) === 409) setError(t('setup.settingUp'))
            else {
                Sentry.captureException(caught, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'avenia_launch' } })
                setError(t('unavailable'))
            }
        } finally {
            setIsStarting(false)
            startingRef.current = false
        }
    }, [refresh, t])

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
