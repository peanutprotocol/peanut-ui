'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import Modal from '@/components/Global/Modal'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { toSumsubLocale } from '@/i18n/app/sumsub-locale'
import { SumsubSdkErrorView } from './SumsubSdkErrorView'
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
 * The native SDK owns the whole screen, so this renders nothing while it is up
 * — only the failure state gets UI. That failure state is the entire point of
 * the component: run the WebSDK in the WebView instead and a Sumsub-side init
 * failure paints *their* "Initialization error" screen inside the iframe, which
 * throws nothing we can catch and reports nothing. Here every exit path is
 * either a resolved launch or a captured exception.
 */
export const SumsubNativeSdk = ({
    visible,
    accessToken,
    onClose,
    onComplete,
    onError,
    onRefreshToken,
}: SumsubSdkProps) => {
    const t = useTranslations('kyc')
    const locale = useLocale()
    const [failure, setFailure] = useState<'sdk-missing' | 'launch' | null>(null)

    const onCloseRef = useRef(onClose)
    const onCompleteRef = useRef(onComplete)
    const onErrorRef = useRef(onError)
    const onRefreshTokenRef = useRef(onRefreshToken)
    const accessTokenRef = useRef(accessToken)
    const sumsubLocaleRef = useRef(toSumsubLocale(locale))

    useEffect(() => {
        onCloseRef.current = onClose
        onCompleteRef.current = onComplete
        onErrorRef.current = onError
        onRefreshTokenRef.current = onRefreshToken
        accessTokenRef.current = accessToken
    }, [onClose, onComplete, onError, onRefreshToken, accessToken])

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
            setFailure(kind)
            onErrorRef.current?.(detail)
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
                    // The promise resolves on close, whatever the user did — so
                    // the status decides between "submitted, go show progress"
                    // and "backed out, just close".
                    if (hasSubmitted || SUBMITTED_STATES.has(result?.status ?? '')) {
                        onCompleteRef.current()
                    } else {
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

    return (
        <Modal
            visible
            onClose={onClose}
            classWrap="h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
            classOverlay="bg-black bg-opacity-50"
            video={false}
            className="z-[100] !p-0 md:!p-6"
            classButtonClose="hidden"
            preventClose={true}
            hideOverlay={false}
        >
            <SumsubSdkErrorView
                onClose={onClose}
                message={failure === 'sdk-missing' ? t('errorSdkUnavailable') : t('wrapper.loadError')}
            />
        </Modal>
    )
}
