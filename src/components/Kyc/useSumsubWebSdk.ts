'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocale } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { toSumsubLocale } from '@/i18n/app/sumsub-locale'
import { evaluateSumsubStatusEvent, type SumsubStatusEventPayload } from './sumsubStatusEvent.utils'
import type { SumsubSdkProps } from './sumsubSdk.types'

// todo: move to consts
const SUMSUB_SDK_URL = 'https://static.sumsub.com/idensic/static/sns-websdk-builder.js'

/**
 * How long the modal may sit open without the SDK launching before we stop
 * pretending it's loading and show the error UI. The Jul-16/17 outage spun
 * forever because nothing was watching: a never-launched SDK throws nothing,
 * requests nothing, and logs nothing. Generous enough for a slow script on a
 * bad connection; short enough that a user gets an actionable screen instead
 * of an infinite spinner.
 */
const SDK_LAUNCH_TIMEOUT_MS = 20_000

/**
 * Some SDK versions replay a resubmission as both `onApplicantResubmitted` and
 * its `idCheck.`-prefixed twin. They arrive in the same tick; a real retry takes
 * a user seconds at minimum, so this window separates the two without needing a
 * per-event identity the SDK does not give us.
 */
const RESUBMIT_TWIN_WINDOW_MS = 1000

type UseSumsubWebSdkArgs = Omit<SumsubSdkProps, 'onClose'>

/**
 * Owns the Sumsub WebSDK lifecycle: script load, init/launch, event wiring,
 * the launch watchdog, and teardown. The consuming view only renders around
 * the container it hands back.
 */
export function useSumsubWebSdk({
    visible,
    sessionKey,
    accessToken,
    onComplete,
    onSubmitted,
    onError,
    onRefreshToken,
    isMultiLevel,
}: UseSumsubWebSdkArgs) {
    const accessTokenRef = useRef(accessToken)
    accessTokenRef.current = accessToken
    const hasAccessToken = !!accessToken
    const [sdkLoaded, setSdkLoaded] = useState(false)
    const [sdkLoadError, setSdkLoadError] = useState(false)
    // Callback ref, NOT useRef: Modal is a headlessui <Transition>, which promotes
    // tree state to Visible inside an effect — so the container mounts a commit
    // AFTER `visible` flips true. (The Portal is not the culprit; it resolves its
    // target synchronously.) A plain ref is not reactive, so the init effect below
    // would read null on its only run and never launch the SDK — the Jul-16/17
    // card outage. State re-runs the effect the moment the node attaches.
    const [sdkContainer, setSdkContainer] = useState<HTMLDivElement | null>(null)
    const sdkInstanceRef = useRef<SnsWebSdkInstance | null>(null)
    const locale = useLocale()
    const sumsubLocaleRef = useRef(toSumsubLocale(locale))

    // callback refs to avoid stale closures in sdk init effect
    const onCompleteRef = useRef(onComplete)
    const onSubmittedRef = useRef(onSubmitted)
    const onErrorRef = useRef(onError)
    const onRefreshTokenRef = useRef(onRefreshToken)
    const isMultiLevelRef = useRef(isMultiLevel)
    // flips to true as soon as any "the user finished something" event fires.
    // Drives the close-confirmation short-circuit: if the user has already
    // submitted, tapping X closes the modal without asking "stop verification?"
    const hasSubmittedRef = useRef(false)
    const lastResubmitSignalRef = useRef(0)
    // Watchdog bookkeeping: did sdk.launch() ever run for this open?
    const hasLaunchedRef = useRef(false)

    useEffect(() => {
        onCompleteRef.current = onComplete
        onSubmittedRef.current = onSubmitted
        onErrorRef.current = onError
        onRefreshTokenRef.current = onRefreshToken
        isMultiLevelRef.current = isMultiLevel
    }, [onComplete, onSubmitted, onError, onRefreshToken, isMultiLevel])

    useEffect(() => {
        sumsubLocaleRef.current = toSumsubLocale(locale)
    }, [locale])

    // stable wrappers that read from refs
    const stableOnComplete = useCallback(() => onCompleteRef.current(), [])
    const stableOnSubmitted = useCallback(() => onSubmittedRef.current?.(), [])
    const stableOnError = useCallback((error: unknown) => onErrorRef.current?.(error), [])
    const stableOnRefreshToken = useCallback(() => onRefreshTokenRef.current(), [])

    // load sumsub websdk script
    useEffect(() => {
        if (window.snsWebSdk) {
            setSdkLoaded(true)
            return undefined
        }

        const handleLoaded = () => setSdkLoaded(true)
        const handleError = () => {
            console.error(new Error('[sumsub] failed to load websdk script'))
            setSdkLoadError(true)
        }

        const existingScript = document.getElementById('sumsub-websdk')
        if (existingScript) {
            // another wrapper instance appended the script and it's still
            // downloading — a bare existence check would init against an
            // undefined window.snsWebSdk
            existingScript.addEventListener('load', handleLoaded)
            existingScript.addEventListener('error', handleError)
            // the script may have finished between the snsWebSdk check above
            // and the listener attach — re-check so we don't wait forever
            if (window.snsWebSdk) handleLoaded()
            return () => {
                existingScript.removeEventListener('load', handleLoaded)
                existingScript.removeEventListener('error', handleError)
            }
        }

        const script = document.createElement('script')
        script.id = 'sumsub-websdk'
        script.src = SUMSUB_SDK_URL
        script.async = true
        script.onload = handleLoaded
        script.onerror = handleError
        document.head.appendChild(script)
        return undefined
    }, [])

    // initialize sdk as soon as the modal is visible and all deps are ready
    useEffect(() => {
        if (!visible || !hasAccessToken || !sdkLoaded || !sdkContainer) return

        // clean up previous instance
        if (sdkInstanceRef.current) {
            try {
                sdkInstanceRef.current.destroy()
            } catch {
                // ignore cleanup errors
            }
        }

        // declared outside try so cleanup can access it
        let iframeObserver: MutationObserver | null = null

        try {
            // track sdk init time so we can ignore stale onApplicantStatusChanged events
            // that fire immediately when the applicant is already approved (e.g. additional-docs flow)
            const sdkInitTime = Date.now()

            const handleSubmitted = () => {
                console.log('[sumsub] onApplicantSubmitted fired')
                const isFirstSubmit = !hasSubmittedRef.current
                hasSubmittedRef.current = true
                // for multi-level workflows (LATAM/EU), the SDK transitions to
                // Level 2 internally. don't close the modal on Level 1 submission —
                // but do report it, or the session never emits a submit signal
                // (onComplete only fires when a close is wanted, and the APPROVED
                // close skips it).
                if (isMultiLevelRef.current) {
                    if (isFirstSubmit) stableOnSubmitted()
                    return
                }
                stableOnComplete()
            }
            // resubmission = user retried after rejection (ACTION_REQUIRED).
            // Multi-level keeps the SDK open: a retry on Level 1 still owes the
            // follow-up questionnaire, so closing here stranded the applicant
            // looking submitted with a level outstanding.
            //
            // EVERY logical retry reports, unlike handleSubmitted's first-only
            // gate. Downstream this is the attempt boundary that lets a repeated
            // rejection be reported again, so suppressing it after the first
            // submission swallowed the retry's own REJECTED. Only the SDK's
            // duplicate twin event is collapsed.
            const handleResubmitted = () => {
                console.log('[sumsub] onApplicantResubmitted fired')
                hasSubmittedRef.current = true
                if (isMultiLevelRef.current) {
                    const now = Date.now()
                    if (now - lastResubmitSignalRef.current >= RESUBMIT_TWIN_WINDOW_MS) {
                        lastResubmitSignalRef.current = now
                        stableOnSubmitted()
                    }
                    return
                }
                stableOnComplete()
            }
            // Applicant Actions (like rain-card-application) emit this instead
            // of onApplicantSubmitted. Without the listener we'd miss the
            // signal and the close button would keep warning about
            // abandonment after a successful action submission.
            const handleActionSubmitted = () => {
                console.log('[sumsub] action submitted fired')
                const isFirstSubmit = !hasSubmittedRef.current
                hasSubmittedRef.current = true
                if (isMultiLevelRef.current) {
                    if (isFirstSubmit) stableOnSubmitted()
                    return
                }
                stableOnComplete()
            }
            // RED stays open so the user can resubmit; the resubmission path
            // emits onApplicantActionSubmitted, which handleActionSubmitted
            // closes. See evaluateSumsubStatusEvent for the early-guard rules.
            const handleStatusEvent = (eventName: string) => (payload: SumsubStatusEventPayload) => {
                console.log(`[sumsub] ${eventName} fired`, payload)
                const evaluation = evaluateSumsubStatusEvent({
                    payload,
                    sdkInitTime,
                    now: Date.now(),
                    isMultiLevel: !!isMultiLevelRef.current,
                })
                if (evaluation.markSubmitted) hasSubmittedRef.current = true
                if (evaluation.autoClose) stableOnComplete()
            }
            const handleStatusChanged = handleStatusEvent('onApplicantStatusChanged')
            const handleActionCompleted = handleStatusEvent('onApplicantActionStatusChanged')

            const sdk = window.snsWebSdk
                .init(accessTokenRef.current!, stableOnRefreshToken)
                .withConf({ lang: sumsubLocaleRef.current, theme: 'light' })
                .withOptions({ addViewportTag: false, adaptIframeHeight: true })
                .on('onApplicantSubmitted', handleSubmitted)
                .on('onApplicantResubmitted', handleResubmitted)
                .on('onApplicantStatusChanged', handleStatusChanged)
                // Applicant Action events (card-application, additional-docs, etc.)
                .on('onActionSubmitted', handleActionSubmitted)
                .on('onApplicantActionSubmitted', handleActionSubmitted)
                .on('onApplicantActionStatusChanged', handleActionCompleted)
                // also listen for idCheck-prefixed events (some sdk versions use these)
                .on('idCheck.onApplicantSubmitted', handleSubmitted)
                .on('idCheck.onApplicantResubmitted', handleResubmitted)
                .on('idCheck.onApplicantStatusChanged', handleStatusChanged)
                .on('idCheck.onActionSubmitted', handleActionSubmitted)
                .on('idCheck.onApplicantActionSubmitted', handleActionSubmitted)
                .on('idCheck.onApplicantActionStatusChanged', handleActionCompleted)
                .on('onError', (error: unknown) => {
                    console.error('[sumsub] sdk error', error)
                    stableOnError(error)
                })
                .build()

            sdk.launch(sdkContainer)
            sdkInstanceRef.current = sdk
            // The positive signal. Without it, "opened" is the only thing we
            // record and a total launch failure is indistinguishable from
            // nobody bothering to verify.
            hasLaunchedRef.current = true
            posthog.capture(ANALYTICS_EVENTS.KYC_SDK_LAUNCHED, { isMultiLevel: !!isMultiLevelRef.current })

            // ensure the sdk-created iframe gets camera/microphone permissions.
            // some sdk versions don't set the allow attribute, which blocks
            // media device access in cross-origin iframes.
            iframeObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLIFrameElement && !node.allow?.includes('camera')) {
                            node.allow = 'camera; microphone; fullscreen'
                        }
                    }
                }
            })
            iframeObserver.observe(sdkContainer, { childList: true })

            // also patch any iframe that was added before the observer
            const existingIframe = sdkContainer.querySelector('iframe')
            if (existingIframe && !existingIframe.allow?.includes('camera')) {
                existingIframe.allow = 'camera; microphone; fullscreen'
            }
        } catch (error) {
            console.error('[sumsub] failed to initialize sdk', error)
            // surface the error UI — without this the modal stays blank
            setSdkLoadError(true)
            posthog.capture(ANALYTICS_EVENTS.KYC_SDK_INIT_FAILED, {
                message: error instanceof Error ? error.message : String(error),
            })
            stableOnError(error)
        }

        return () => {
            iframeObserver?.disconnect()
            if (sdkInstanceRef.current) {
                try {
                    sdkInstanceRef.current.destroy()
                } catch {
                    // ignore cleanup errors
                }
                sdkInstanceRef.current = null
            }
        }
    }, [
        visible,
        hasAccessToken,
        sessionKey,
        sdkLoaded,
        sdkContainer,
        stableOnComplete,
        stableOnSubmitted,
        stableOnError,
        stableOnRefreshToken,
    ])

    // reset state when modal closes (the init effect's cleanup already
    // destroys the SDK instance — visible is one of its deps)
    useEffect(() => {
        if (!visible) {
            setSdkLoadError(false)
            hasSubmittedRef.current = false
            hasLaunchedRef.current = false
        }
    }, [visible])

    // Watchdog: the modal is open but the SDK never launched.
    //
    // Deliberately keyed on `visible` ALONE, not on the init effect's deps. Every
    // way this component can fail silently — a null container, a token that never
    // arrives, a script that never loads — ends with the init effect simply not
    // running, so anything that watches those deps would also never run. Watching
    // the one fact the user cares about ("I opened it and nothing happened")
    // catches the whole class, including failures we haven't thought of yet.
    useEffect(() => {
        if (!visible) return
        const timer = setTimeout(() => {
            if (hasLaunchedRef.current) return
            console.error('[sumsub] sdk never launched within timeout — surfacing error')
            posthog.capture(ANALYTICS_EVENTS.KYC_SDK_LAUNCH_TIMEOUT, {
                timeoutMs: SDK_LAUNCH_TIMEOUT_MS,
                // The three deps whose absence explains every silent stall.
                hadAccessToken: !!accessToken,
                sdkScriptLoaded: sdkLoaded,
                hadContainer: !!sdkContainer,
            })
            setSdkLoadError(true)
        }, SDK_LAUNCH_TIMEOUT_MS)
        return () => clearTimeout(timer)
        // accessToken/sdkLoaded/sdkContainer are read for diagnostics only; they
        // must not restart the timer or a late-arriving dep would reset the clock.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible])

    return { sdkLoadError, setSdkContainer, hasSubmittedRef }
}
