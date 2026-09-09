'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { toSumsubLocale } from '@/i18n/app/sumsub-locale'
import { SumsubWebSdkModal } from './SumsubWebSdkModal'
import type { SumsubSdkProps } from './sumsubSdk.types'

/**
 * `SNSSDKState`s that mean the applicant reached Sumsub — the native analogue
 * of the web SDK's onApplicantSubmitted/onApplicantActionSubmitted events,
 * which the Cordova plugin does not forward. Everything before Pending
 * (Ready/Initial/Incomplete) means the user backed out mid-flow.
 */
const SUBMITTED_STATES = new Set(['Pending', 'TemporarilyDeclined', 'FinallyRejected', 'Approved', 'ActionCompleted'])

/**
 * Drives the Sumsub Cordova SDK inside the Capacitor shell.
 *
 * The native SDK owns the whole screen, so this renders nothing while it is up.
 * When the native SDK cannot start at all (plugin missing from the binary,
 * init throw, launch rejection — e.g. the 1.5.0+21653381 Android build that
 * shipped without the Cordova plugin's native class), falling over to the
 * WebSDK in the WebView beats a dead-end error screen: the WebSDK is the
 * battle-tested PWA path and runs in the WebView. The trade-off that made
 * native primary still stands — a Sumsub-side init failure in the web iframe
 * is silent to our handlers — but as a fallback that risk only exists for
 * users who otherwise could not verify at all. Every native failure is still
 * captured to Sentry/PostHog before the fallback renders.
 */
export const SumsubNativeSdk = ({
    visible,
    accessToken,
    onClose,
    onComplete,
    onError,
    onRefreshToken,
    onSubmitted,
    isMultiLevel,
}: SumsubSdkProps) => {
    const locale = useLocale()
    const [failure, setFailure] = useState<'sdk-missing' | 'launch' | null>(null)

    const onCloseRef = useRef(onClose)
    const onCompleteRef = useRef(onComplete)
    const onRefreshTokenRef = useRef(onRefreshToken)
    const accessTokenRef = useRef(accessToken)
    const isMultiLevelRef = useRef(isMultiLevel)
    const onSubmittedRef = useRef(onSubmitted)
    const sumsubLocaleRef = useRef(toSumsubLocale(locale))

    useEffect(() => {
        onCloseRef.current = onClose
        onCompleteRef.current = onComplete
        onRefreshTokenRef.current = onRefreshToken
        accessTokenRef.current = accessToken
        isMultiLevelRef.current = isMultiLevel
        onSubmittedRef.current = onSubmitted
    }, [onClose, onComplete, onRefreshToken, accessToken, isMultiLevel, onSubmitted])

    useEffect(() => {
        sumsubLocaleRef.current = toSumsubLocale(locale)
    }, [locale])

    // Gate on token PRESENCE, not identity: refreshToken() writes a new token
    // into the same state, and re-running this effect on that would dismiss and
    // relaunch the native screen out from under a user mid-verification.
    const hasAccessToken = !!accessToken

    useEffect(() => {
        if (!visible || !hasAccessToken) return

        const reportFailure = (reason: string, detail: unknown, kind: 'sdk-missing' | 'launch' = 'launch') => {
            console.error('[sumsub] native sdk failure', reason, detail)
            posthog.capture(ANALYTICS_EVENTS.KYC_SDK_INIT_FAILED, {
                platform: 'native',
                reason,
                message: detail instanceof Error ? detail.message : String(detail),
            })
            Sentry.captureException(detail instanceof Error ? detail : new Error(`[sumsub] native ${reason}`), {
                tags: { sumsub_sdk: 'native', sumsub_failure: reason },
                extra: { detail },
            })
            // Falling back to the WebSDK is recovery, not a terminal error, so
            // the parent's onError stays quiet here; the web driver still calls
            // it if the fallback itself fails.
            posthog.capture(ANALYTICS_EVENTS.KYC_WEB_FALLBACK_USED, { platform: 'native', reason })
            setFailure(kind)
        }

        const sumsub = window.SNSMobileSDK
        if (!sumsub) {
            reportFailure('sdk-unavailable', new Error('window.SNSMobileSDK is undefined'), 'sdk-missing')
            return
        }

        let instance: SNSMobileSDKInstance | null = null
        let cancelled = false
        let hasSubmitted = false

        try {
            instance = sumsub
                .init(accessTokenRef.current!, () => onRefreshTokenRef.current())
                .withHandlers({
                    onStatusChanged: (event) => {
                        if (event?.newStatus && SUBMITTED_STATES.has(event.newStatus)) hasSubmitted = true
                    },
                })
                .withLocale(sumsubLocaleRef.current)
                .withDebug(process.env.NODE_ENV === 'development')
                .build()

            posthog.capture(ANALYTICS_EVENTS.KYC_SDK_LAUNCHED, { platform: 'native' })

            instance.launch().then(
                (result) => {
                    if (cancelled) return
                    if (result?.success === false) {
                        reportFailure(result.errorType || 'sdk-failed', new Error(result.errorMsg || result.status))
                        return
                    }
                    // Native status is per level. Only the backend confirms a complete workflow.
                    const closedSubmitted = SUBMITTED_STATES.has(result?.status ?? '')
                    if (!isMultiLevelRef.current && (hasSubmitted || closedSubmitted)) {
                        onCompleteRef.current()
                    } else {
                        // The level they DID finish still counts for the funnel —
                        // routing this as a close must not also lose the submit.
                        if (hasSubmitted || closedSubmitted) onSubmittedRef.current?.()
                        onCloseRef.current()
                    }
                },
                (error) => {
                    if (cancelled) return
                    reportFailure('launch-rejected', error)
                }
            )
        } catch (error) {
            reportFailure('init-threw', error)
        }

        return () => {
            cancelled = true
            // Releases the plugin's module-level single-instance lock. Skip it
            // and the next launch rejects with "Aborted since another instance
            // is in use!" for the rest of the app's lifetime.
            try {
                instance?.dismiss()
            } catch {
                // already gone
            }
        }
    }, [visible, hasAccessToken])

    useEffect(() => {
        if (!visible) setFailure(null)
    }, [visible])

    if (!visible || !failure) return null

    // Native SDK could not start — hand the same session to the WebSDK. The web
    // driver owns its own load-error UI, so a fallback that also fails still
    // ends in an actionable error screen rather than a blank modal.
    return (
        <SumsubWebSdkModal
            visible={visible}
            accessToken={accessToken}
            onClose={onClose}
            onComplete={onComplete}
            onSubmitted={onSubmitted}
            onError={onError}
            onRefreshToken={onRefreshToken}
            isMultiLevel={isMultiLevel}
        />
    )
}
