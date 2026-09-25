'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import Modal from '@/components/Global/Modal'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { toSumsubLocale } from '@/i18n/app/sumsub-locale'
import { isAndroidNativeBridge } from '@/utils/capacitor'
import { SumsubSdkErrorView } from './SumsubSdkErrorView'
import type { SumsubSdkProps } from './sumsubSdk.types'

/**
 * `SNSSDKState`s that mean the applicant reached Sumsub — the native analogue
 * of the web SDK's onApplicantSubmitted/onApplicantActionSubmitted events,
 * which the Cordova plugin does not forward. Everything before Pending
 * (Ready/Initial/Incomplete) means the user backed out mid-flow.
 */
const SUBMITTED_STATES = new Set(['Pending', 'TemporarilyDeclined', 'FinallyRejected', 'Approved', 'ActionCompleted'])
const STALE_INSTANCE_ERROR = 'Aborted since another instance is in use!'

const isStaleInstanceError = (error: unknown) =>
    (error instanceof Error ? error.message : String(error)).includes(STALE_INSTANCE_ERROR)

/**
 * How long a resumed Android WebView waits for the plugin's close callback
 * before it treats the native SDK screen as destroyed. A normal close sends
 * the callback as the SDK screen finishes, well inside this window.
 */
export const ORPHANED_SDK_GRACE_MS = 2000

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
    onSubmitted,
    isMultiLevel,
}: SumsubSdkProps) => {
    const t = useTranslations('kyc')
    const locale = useLocale()
    const [failure, setFailure] = useState<'sdk-missing' | 'launch' | null>(null)

    const onCloseRef = useRef(onClose)
    const onCompleteRef = useRef(onComplete)
    const onErrorRef = useRef(onError)
    const onRefreshTokenRef = useRef(onRefreshToken)
    const accessTokenRef = useRef(accessToken)
    const isMultiLevelRef = useRef(isMultiLevel)
    const onSubmittedRef = useRef(onSubmitted)
    const sumsubLocaleRef = useRef(toSumsubLocale(locale))

    useEffect(() => {
        onCloseRef.current = onClose
        onCompleteRef.current = onComplete
        onErrorRef.current = onError
        onRefreshTokenRef.current = onRefreshToken
        accessTokenRef.current = accessToken
        isMultiLevelRef.current = isMultiLevel
        onSubmittedRef.current = onSubmitted
    }, [onClose, onComplete, onError, onRefreshToken, accessToken, isMultiLevel, onSubmitted])

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
        let settled = false
        let hasSubmitted = false
        let orphanTimer: ReturnType<typeof setTimeout> | undefined
        let removeResumeListener: (() => void) | undefined

        const handleExit = (status: string | undefined) => {
            // Native status is per level. Only the backend confirms a complete workflow.
            const closedSubmitted = SUBMITTED_STATES.has(status ?? '')
            if (!isMultiLevelRef.current && (hasSubmitted || closedSubmitted)) {
                onCompleteRef.current()
            } else {
                // The level they DID finish still counts for the funnel —
                // routing this as a close must not also lose the submit.
                if (hasSubmitted || closedSubmitted) onSubmittedRef.current?.()
                onCloseRef.current()
            }
        }

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

            // The Cordova wrapper keeps a module-level instance lock until its
            // launch promise settles. A backgrounded native screen can disappear
            // without settling that promise; dismiss() does not clear the lock.
            // Recover only this exact rejection and retry once after resetting
            // the wrapper's JavaScript state. Other native failures still surface.
            const launchWithStaleLockRecovery = async () => {
                try {
                    return await instance!.launch()
                } catch (error) {
                    if (cancelled || !isStaleInstanceError(error) || !sumsub.reset) throw error
                    sumsub.reset()
                    return instance!.launch()
                }
            }

            void launchWithStaleLockRecovery().then(
                (result) => {
                    if (cancelled || settled) return
                    settled = true
                    if (result?.success === false) {
                        reportFailure(result.errorType || 'sdk-failed', new Error(result.errorMsg || result.status))
                        return
                    }
                    handleExit(result?.status)
                },
                (error) => {
                    if (cancelled || settled) return
                    settled = true
                    reportFailure('launch-rejected', error)
                }
            )

            // Android runs the SDK as its own activity above the WebView's, so
            // the WebView only resumes once the SDK screen is gone. If the OS
            // destroyed that screen (task cleared, activity reclaimed), the plugin
            // never calls back: launch() stays pending, the instance lock stays
            // held, and Verify does nothing until the app is killed. A resume
            // with no callback after a grace period means exactly that, so
            // release the lock and exit the flow like a normal close. iOS is
            // excluded: its app state follows the whole app, not the WebView,
            // so a resume there says nothing about the SDK screen.
            if (isAndroidNativeBridge()) {
                void import('@capacitor/app')
                    .then(({ App }) =>
                        App.addListener('appStateChange', ({ isActive }) => {
                            // Capacitor reports active on every resume but inactive
                            // only once the WebView is fully covered. A resume just
                            // before the SDK screen opens (a permission prompt) is
                            // followed by that inactive, which cancels the check.
                            clearTimeout(orphanTimer)
                            if (!isActive || settled || cancelled) return
                            orphanTimer = setTimeout(() => {
                                if (settled || cancelled) return
                                settled = true
                                posthog.capture(ANALYTICS_EVENTS.KYC_SDK_ORPHANED, { platform: 'native' })
                                sumsub.reset?.()
                                handleExit(undefined)
                            }, ORPHANED_SDK_GRACE_MS)
                        })
                    )
                    .then((handle) => {
                        if (cancelled) void handle.remove()
                        else removeResumeListener = () => void handle.remove()
                    })
                    .catch(() => {
                        // no app plugin: nothing to recover with
                    })
            }
        } catch (error) {
            reportFailure('init-threw', error)
        }

        return () => {
            cancelled = true
            clearTimeout(orphanTimer)
            removeResumeListener?.()
            // Close the native screen when the React flow ends. The plugin may
            // leave its JavaScript lock behind; the next launch recovers it above.
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
            classOverlay="bg-black/50"
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
