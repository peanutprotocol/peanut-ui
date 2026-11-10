'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { consentApi } from '@/services/consent'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'

export interface RouteTermsAcceptance {
    /** Call from the control under the named and linked terms: the request records the acceptance. */
    accept: () => Promise<void>
    isAccepting: boolean
    /** Localized failure; null when there is none. */
    error: string | null
}

/**
 * The route's accept-tos step (`accept-tos:<provider>`, a `nextActions` key):
 * POST /users/kyc/accept-terms records the consent and enrols the user. The
 * capabilities are then read again; the route says pending while the provider
 * reviews, and the user poller follows the pending rail to ready or refused.
 * A 409 means the route no longer names this step: the capabilities say what now.
 */
export function useRouteTermsAcceptance(key: string | undefined): RouteTermsAcceptance {
    const t = useTranslations('pix')
    const { fetchUser } = useAuth()
    const [isAccepting, setIsAccepting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // a fast second tap must not record the acceptance twice
    const acceptingRef = useRef(false)

    const accept = useCallback(async () => {
        if (!key || acceptingRef.current) return
        acceptingRef.current = true
        setError(null)
        setIsAccepting(true)
        try {
            await consentApi.acceptRouteTerms(key)
            markSubmitted()
            await fetchUser().catch(() => undefined)
        } catch (caught) {
            if (wireErrorCode(caught) === API_ERROR_CODES.ROUTE_NOT_AVAILABLE) {
                await fetchUser().catch(() => undefined)
                return
            }
            // 500: the API could not store the consent, so nothing was enrolled
            if (apiErrorStatus(caught) === 500) {
                setError(t('setup.termsNotSaved'))
                return
            }
            Sentry.captureException(caught, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'route_terms' } })
            setError(t('unavailable'))
        } finally {
            setIsAccepting(false)
            acceptingRef.current = false
        }
    }, [key, fetchUser, t])

    return { accept, isAccepting, error }
}
