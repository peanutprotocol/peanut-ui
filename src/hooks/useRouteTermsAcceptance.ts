'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { consentApi } from '@/services/consent'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { pixRouteTerms } from '@/features/pix/pixRouteStep'
import type { UserCapabilities } from '@/types/capabilities'
import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'

export interface RouteTermsAcceptance {
    /** Call from the control under the named and linked terms: the request records the acceptance. */
    accept: () => Promise<void>
    isAccepting: boolean
    /** Localized failure; null when there is none. */
    error: string | null
}

/** Whether a route still names the terms `key` in either shape (`pixRouteTerms`). */
const routesNameTerms = (capabilities: UserCapabilities | undefined, key: string): boolean =>
    !!capabilities?.routes?.some((route) => pixRouteTerms(route, capabilities.nextActions)?.key === key)

/**
 * The route's accept-tos step (`accept-tos:<provider>`, the route's `terms.key`
 * or a `nextActions` key): POST /users/kyc/accept-terms records the consent and
 * enrols the user. The capabilities are then read again, and the route names
 * the next step: the account the first use opens, the wait, or ready.
 * A 409 means the route no longer names this step: the capabilities say what now. A 409 while
 * the read after it still names the terms says the step is unavailable, so a tap never loops silently.
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
                const user = await fetchUser().catch(() => null)
                // the route moved on: the capabilities say what now. Still naming these terms, a
                // second tap would be refused the same way, so the user hears it and Sentry once.
                if (routesNameTerms(user?.capabilities, key)) {
                    Sentry.captureException(caught, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'route_terms' } })
                    setError(t('unavailable'))
                }
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
