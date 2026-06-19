import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import {
    initiateSumsubKyc,
    initiateSelfHealResubmission,
    restartIdentityVerification,
    startKycAction,
} from '@/app/actions/sumsub'
import { type KYCRegionIntent, type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { isCapacitor } from '@/utils/capacitor'

interface UseSumsubKycFlowOptions {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

export const useSumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent }: UseSumsubKycFlowOptions = {}) => {
    const { user } = useUserStore()
    const router = useRouter()

    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [showWrapper, setShowWrapper] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isVerificationProgressModalOpen, setIsVerificationProgressModalOpen] = useState(false)
    const [liveKycStatus, setLiveKycStatus] = useState<SumsubKycStatus | undefined>(undefined)
    const [rejectLabels, setRejectLabels] = useState<string[] | undefined>(undefined)
    // true when the SDK is showing an applicant action (not a standard level)
    const [isActionFlow, setIsActionFlow] = useState(false)
    const prevStatusRef = useRef(liveKycStatus)
    const showWrapperRef = useRef(showWrapper)
    showWrapperRef.current = showWrapper
    // tracks the effective region intent across initiate + refresh so the correct template is always used
    const regionIntentRef = useRef<KYCRegionIntent | undefined>(regionIntent)
    // tracks the level name across initiate + refresh (e.g. 'peanut-additional-docs')
    const levelNameRef = useRef<string | undefined>(undefined)
    // tracks the selected target country across initiate + refresh for country-scoped Manteca actions
    const targetCountryRef = useRef<string | undefined>(undefined)
    // guards fetchCurrentStatus from running while handleInitiateKyc is in progress
    const initiatingRef = useRef(false)
    // guard: only fire onKycSuccess when the user initiated a kyc flow in this session.
    // prevents stale websocket events or mount-time fetches from auto-closing the drawer.
    const userInitiatedRef = useRef(false)
    // tracks self-heal provider for token refresh — null when in regular KYC flow
    const selfHealProviderRef = useRef<'BRIDGE' | 'MANTECA' | null>(null)

    useEffect(() => {
        regionIntentRef.current = regionIntent
    }, [regionIntent])

    // listen for sumsub kyc status updates via websocket
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onSumsubKycStatusUpdate: (newStatus, newRejectLabels) => {
            setLiveKycStatus(newStatus as SumsubKycStatus)
            if (newRejectLabels) setRejectLabels(newRejectLabels)
        },
    })

    // react to status transitions
    useEffect(() => {
        const prevStatus = prevStatusRef.current
        prevStatusRef.current = liveKycStatus

        if (prevStatus !== 'APPROVED' && liveKycStatus === 'APPROVED') {
            // if SDK is still open (LATAM multi-level), close it now —
            // applicantWorkflowCompleted has fired, all levels are done.
            if (showWrapperRef.current) {
                setShowWrapper(false)
                setIsVerificationProgressModalOpen(true)
                userInitiatedRef.current = true
            }
            if (userInitiatedRef.current) {
                onKycSuccess?.()
            }
        } else if (
            liveKycStatus &&
            liveKycStatus !== prevStatus &&
            liveKycStatus !== 'APPROVED' &&
            liveKycStatus !== 'PENDING' &&
            liveKycStatus !== 'REVERIFYING'
        ) {
            // close modal for any non-success terminal state (REJECTED, ACTION_REQUIRED, FAILED, etc.)
            setIsVerificationProgressModalOpen(false)
        }
    }, [liveKycStatus, onKycSuccess])

    // fetch current status to recover from missed websocket events.
    // skip when regionIntent is undefined to avoid creating an applicant with the wrong template
    // (e.g. RegionsVerification mounts with no region selected yet).
    useEffect(() => {
        if (!regionIntent) return
        // skip if handleInitiateKyc is already in progress — it handles status sync itself
        if (initiatingRef.current) return
        // skip if user already initiated a flow in this session — the SDK or
        // handleInitiateKyc manages status from here. without this guard,
        // the async fetch can resolve after initiatingRef is reset but before
        // showWrapperRef is updated by the batched render, causing a false
        // APPROVED transition that closes the SDK.
        if (userInitiatedRef.current) return

        const fetchCurrentStatus = async () => {
            try {
                const response = await initiateSumsubKyc({ regionIntent })
                if (response.data?.status && !initiatingRef.current && !showWrapperRef.current) {
                    setLiveKycStatus(response.data.status)
                }
            } catch {
                // silent failure - we just show the user an error when they try to initiate the kyc flow if the api call is failing
            }
        }

        fetchCurrentStatus()
    }, [regionIntent])

    // polling fallback for missed websocket events.
    // when the verification progress modal is open, poll status every 5s
    // so the flow can transition even if the websocket event never arrives.
    useEffect(() => {
        if (!isVerificationProgressModalOpen) return

        const pollStatus = async () => {
            try {
                const response = await initiateSumsubKyc({
                    regionIntent: regionIntentRef.current,
                    levelName: levelNameRef.current,
                    targetCountry: targetCountryRef.current,
                })
                if (response.data?.status) {
                    setLiveKycStatus(response.data.status)
                }
            } catch {
                // silent — polling is a best-effort fallback
            }
        }

        const interval = setInterval(pollStatus, 5000)
        return () => clearInterval(interval)
    }, [isVerificationProgressModalOpen])

    const handleInitiateKyc = useCallback(
        async (
            overrideIntent?: KYCRegionIntent,
            levelName?: string,
            crossRegion?: boolean,
            rawTargetCountry?: string
        ) => {
            // targetCountry is only ever consumed by the BE as a Manteca geo
            // (pendingMantecaGeo stamp + action externalId suffix). Call sites
            // pass the raw destination country for EVERY `latam`-region country
            // (MX, CL, …), but Manteca only serves AR/BR — an unsupported stamp
            // poisons the verification metadata (first-write-wins) and bails
            // every later geo resolution, so drop it at this choke point.
            const normalizedTargetCountry = rawTargetCountry?.toUpperCase()
            const targetCountry =
                normalizedTargetCountry && isMantecaSupportedCountryCode(normalizedTargetCountry)
                    ? normalizedTargetCountry
                    : undefined
            userInitiatedRef.current = true
            initiatingRef.current = true
            selfHealProviderRef.current = null
            setIsLoading(true)
            setError(null)

            // for cross-region: pre-set prevStatusRef to APPROVED so the fetchCurrentStatus
            // effect (which also fires when regionIntent changes) doesn't trigger onKycSuccess
            // when it sees the existing APPROVED status. save previous value to restore on failure.
            const savedPrevStatus = prevStatusRef.current
            if (crossRegion) {
                prevStatusRef.current = 'APPROVED'
            }

            try {
                const response = await initiateSumsubKyc({
                    regionIntent: overrideIntent ?? regionIntent,
                    levelName,
                    crossRegion,
                    targetCountry,
                })

                if (response.error) {
                    // same race the unsupported-region branch closes below: restoring
                    // prevStatusRef while leaving userInitiatedRef set lets a late/stale
                    // websocket APPROVED event fire onKycSuccess on top of this error.
                    // every terminal-error exit must clear the user-initiated guard.
                    userInitiatedRef.current = false
                    if (crossRegion) prevStatusRef.current = savedPrevStatus
                    setError(response.error)
                    return
                }

                // cross-region into a region no first-party bank provider serves (ROW).
                // the backend approved identity but can't auto-enroll any rail, so it
                // signals 'unsupported-region' (status APPROVED, no token) instead of a
                // silent no-op. surface an honest, terminal message and bail BEFORE the
                // status sync below — syncing APPROVED here would trip the transition
                // effect into firing onKycSuccess, looping the user back to "all set".
                //
                // clear userInitiatedRef so a late/stale websocket APPROVED event can't
                // satisfy the transition-effect guard and fire onKycSuccess after this
                // terminal error (the user is approved but has no rail — NOT a success).
                if (response.data?.actionType === 'unsupported-region') {
                    userInitiatedRef.current = false
                    setError(
                        "Bank deposits aren't available in your region yet. We'll let you know as soon as they go live."
                    )
                    return
                }

                // sync status from api response, but skip when a token is returned
                // alongside APPROVED — that means the SDK should open (e.g. additional-docs flow),
                // not that kyc is finished. syncing APPROVED here would trigger the useEffect
                // which fires onKycSuccess and closes everything before the SDK opens.
                if (response.data?.status && !(response.data.status === 'APPROVED' && response.data.token)) {
                    setLiveKycStatus(response.data.status)
                }

                // update effective intent + level for token refresh
                const effectiveIntent = overrideIntent ?? regionIntent
                if (effectiveIntent) regionIntentRef.current = effectiveIntent
                levelNameRef.current = levelName
                targetCountryRef.current = targetCountry

                // cross-region: bridge-direct means no SDK needed — backend is handling
                // rail enrollment + submission. go straight to the post-approval flow.
                if (response.data?.actionType === 'bridge-direct') {
                    prevStatusRef.current = 'APPROVED'
                    userInitiatedRef.current = true
                    setIsActionFlow(false)
                    setIsVerificationProgressModalOpen(true)
                    onKycSuccess?.()
                    return
                }

                // if already approved (or reverifying) and no token returned, kyc is done.
                // set prevStatusRef so the transition effect doesn't fire onKycSuccess a second time.
                // when a token IS returned (e.g. cross-region action or additional-docs), we still need to show the SDK.
                const status = response.data?.status
                if ((status === 'APPROVED' || status === 'REVERIFYING') && !response.data?.token) {
                    prevStatusRef.current = status
                    onKycSuccess?.()
                    return
                }

                if (response.data?.token) {
                    // in capacitor, launch native sumsub sdk instead of web wrapper
                    if (isCapacitor()) {
                        try {
                            const SNSMobileSDK = (window as any).SNSMobileSDK
                            if (!SNSMobileSDK) {
                                userInitiatedRef.current = false
                                setError('KYC SDK not available. Please update the app.')
                                return
                            }
                            const effectiveRegionIntent = overrideIntent ?? regionIntent
                            const sdk = SNSMobileSDK.init(response.data.token, async () => {
                                // keep parity with the web refreshToken below — dropping
                                // targetCountry here would mint a token for a different
                                // (suffix-less) applicant action than the one the user is in.
                                const r = await initiateSumsubKyc({
                                    regionIntent: effectiveRegionIntent,
                                    levelName: levelNameRef.current,
                                    targetCountry: targetCountryRef.current,
                                })
                                return r.data?.token || ''
                            })
                                .withHandlers({
                                    onStatusChanged: (event: any) => {
                                        console.log('[useSumsubKycFlow] native onStatusChanged:', JSON.stringify(event))
                                        if (event?.newStatus === 'Approved') {
                                            onKycSuccess?.()
                                        }
                                    },
                                })
                                .withLocale('en')
                                .withDebug(process.env.NODE_ENV === 'development')
                                .build()

                            const result = await sdk.launch()
                            console.log('[useSumsubKycFlow] native SDK result:', JSON.stringify(result))
                            if (result?.status === 'Approved') {
                                onKycSuccess?.()
                            }
                        } catch (nativeErr) {
                            console.error('[useSumsubKycFlow] native SDK error:', nativeErr)
                            userInitiatedRef.current = false
                            setError('Verification failed. Please try again.')
                        }
                        return
                    }

                    setAccessToken(response.data.token)
                    setIsActionFlow(!!response.data.actionType)
                    setShowWrapper(true)
                } else {
                    userInitiatedRef.current = false
                    setError('Could not initiate verification. Please try again.')
                }
            } catch (e: unknown) {
                userInitiatedRef.current = false
                if (crossRegion) prevStatusRef.current = savedPrevStatus
                const message = e instanceof Error ? e.message : 'An unexpected error occurred'
                setError(message)
            } finally {
                setIsLoading(false)
                initiatingRef.current = false
            }
        },
        [regionIntent, onKycSuccess]
    )

    // called when sdk signals applicant submitted
    const handleSdkComplete = useCallback(() => {
        userInitiatedRef.current = true
        selfHealProviderRef.current = null
        setShowWrapper(false)
        setIsActionFlow(false)
        setIsVerificationProgressModalOpen(true)
    }, [])

    // called when user manually closes the sdk modal
    const handleClose = useCallback(() => {
        setShowWrapper(false)
        setIsActionFlow(false)
        onManualClose?.()
    }, [onManualClose])

    // token refresh function passed to the sdk for when the token expires.
    // uses self-heal provider ref when in self-heal mode, otherwise regular KYC endpoint.
    const refreshToken = useCallback(async (): Promise<string> => {
        if (selfHealProviderRef.current) {
            const response = await initiateSelfHealResubmission(selfHealProviderRef.current)
            if (response.error || !response.data?.token) {
                throw new Error(response.error || 'Failed to refresh self-heal token')
            }
            setAccessToken(response.data.token)
            return response.data.token
        }

        const response = await initiateSumsubKyc({
            regionIntent: regionIntentRef.current,
            levelName: levelNameRef.current,
            targetCountry: targetCountryRef.current,
        })

        if (response.error || !response.data?.token) {
            throw new Error(response.error || 'Failed to refresh token')
        }

        setAccessToken(response.data.token)
        return response.data.token
    }, [])

    const closeVerificationProgressModal = useCallback(() => {
        setIsVerificationProgressModalOpen(false)
    }, [])

    const closeVerificationModalAndGoHome = useCallback(() => {
        setIsVerificationProgressModalOpen(false)
        router.push('/home')
    }, [router])

    const resetError = useCallback(() => {
        setError(null)
    }, [])

    // Reset Sumsub IDENTITY step + open the WebSDK with a fresh token. The
    // user lands back on the document-upload screen so they can verify with a
    // different ID. Used as the CTA for the `restart-identity` gate state
    // (Manteca country-ineligibility — uploaded a non-AR/BR document).
    const handleRestartIdentity = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        userInitiatedRef.current = true
        // Clear any prior self-heal context so refreshToken (below) doesn't
        // mistakenly hit the self-heal endpoint after a restart-identity flow
        // (CodeRabbit caught: stale selfHealProviderRef would route the next
        // refresh through initiateSelfHealResubmission instead of the regular path).
        selfHealProviderRef.current = null

        try {
            const response = await restartIdentityVerification()
            if (response.error) {
                userInitiatedRef.current = false
                setError(response.error)
                return
            }
            if (response.data?.token) {
                setAccessToken(response.data.token)
                setShowWrapper(true)
            } else {
                userInitiatedRef.current = false
                setError('Could not restart identity verification. Please try again.')
            }
        } catch (e: unknown) {
            userInitiatedRef.current = false
            const message = e instanceof Error ? e.message : 'An unexpected error occurred'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // initiate self-heal document resubmission: calls the resubmit API
    // and opens the sumsub SDK with the action token
    const handleSelfHealResubmit = useCallback(async (provider: 'BRIDGE' | 'MANTECA') => {
        setIsLoading(true)
        setError(null)
        userInitiatedRef.current = true
        selfHealProviderRef.current = provider

        try {
            const response = await initiateSelfHealResubmission(provider)

            if (response.error) {
                userInitiatedRef.current = false
                selfHealProviderRef.current = null
                setError(response.error)
                return
            }

            if (response.data?.token) {
                setAccessToken(response.data.token)
                setShowWrapper(true)
            } else {
                userInitiatedRef.current = false
                selfHealProviderRef.current = null
                setError('Could not initiate document resubmission. Please try again.')
            }
        } catch (e: unknown) {
            userInitiatedRef.current = false
            selfHealProviderRef.current = null
            const message = e instanceof Error ? e.message : 'An unexpected error occurred'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Start a capability nextAction by key (POST /users/kyc/start-action) and
    // open the WebSDK with the returned token. Unlike handleInitiateKyc (which
    // resolves the level from region and no-ops for an already-approved user),
    // this mints a token for the specific RFI level the key maps to — the path
    // the advisory pre-empt needs to start a future-dated requirement early.
    const handleStartAction = useCallback(async (key: string) => {
        setIsLoading(true)
        setError(null)
        userInitiatedRef.current = true
        selfHealProviderRef.current = null

        try {
            const response = await startKycAction(key)
            if (response.error || !response.data?.token) {
                userInitiatedRef.current = false
                setError(response.error || 'Could not start verification. Please try again.')
                return
            }
            levelNameRef.current = response.data.levelName
            setAccessToken(response.data.token)
            setIsActionFlow(true)
            setShowWrapper(true)
        } catch (e: unknown) {
            userInitiatedRef.current = false
            const message = e instanceof Error ? e.message : 'An unexpected error occurred'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        isLoading,
        error,
        showWrapper,
        accessToken,
        liveKycStatus,
        rejectLabels,
        handleInitiateKyc,
        handleRestartIdentity,
        handleSelfHealResubmit,
        handleStartAction,
        handleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        closeVerificationModalAndGoHome,
        resetError,
        isActionFlow,
    }
}
