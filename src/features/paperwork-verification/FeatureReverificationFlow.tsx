'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { startFeatureReverification } from '@/app/actions/kyc-reverification'
import { findKycDocumentPlan, candidateDocumentStatus, getKycFeatures } from '@/app/actions/kyc-workflow'
import { captureSessionFence } from '@/utils/session-fence'
import { identityRejection } from '@/utils/identity-rejection.utils'
import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type { PaperworkVerificationFeature } from '@/app/actions/types/kyc-paperwork-verification.types'
import type {
    FeatureReverificationEntry,
    FeatureReverificationStartConflictCode,
} from '@/app/actions/types/kyc-reverification.types'
import {
    isFeatureReverificationEntry,
    isFeatureReverificationOutcome,
    kycRetryDeadline,
    safeReverificationReturnTo,
} from '@/utils/kyc-reverification'
import { LoadFailed, VerifyLoading } from './components/LoadScreens'
import { ReviewScreen } from './components/StatusScreens'
import { StepsScreen } from './components/StepsScreen'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'
import { PaperworkVerificationFlow } from './PaperworkVerificationFlow'
import { PaperworkVerificationTrackingProvider, useKycControl } from './analytics'

type FlowProps = {
    feature: PaperworkVerificationFeature
    returnTo?: string | null
    targetProvider?: FeatureReverificationEntry['targetProvider'] | null
    onExit: () => void
}

const invitationCopy = { card: 'inviteCard', bank: 'inviteBank', local: 'inviteLocal' } as const
const refusalCopy = { card: 'refusalCard', bank: 'refusalBank', local: 'refusalLocal' } as const
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const RECONCILE_CODES: readonly string[] = [
    'reverification_not_required',
    'reverification_finished',
] satisfies readonly FeatureReverificationStartConflictCode[]
const refusalCode: FeatureReverificationStartConflictCode = 'feature_not_open'

function clearStorage(key: string) {
    try {
        sessionStorage.removeItem(key)
    } catch {
        // Embedded browsers can deny session storage access.
    }
}

function readResume(storageKey: string) {
    try {
        const raw = sessionStorage.getItem(storageKey)
        if (!raw || raw.length > 2048) return null
        const saved = JSON.parse(raw) as { entry?: unknown; allowReturn?: unknown }
        if (!isFeatureReverificationEntry(saved?.entry) || !saved.entry.attemptId) return null
        return { entry: saved.entry, allowReturn: saved.allowReturn === true }
    } catch {
        return null
    }
}

function saveResume(storageKey: string, entry: FeatureReverificationEntry, allowReturn: boolean) {
    try {
        const { kind, feature, targetProvider, attemptId } = entry
        sessionStorage.setItem(
            storageKey,
            JSON.stringify({ entry: { kind, feature, targetProvider, attemptId }, allowReturn })
        )
    } catch {
        // The current view can still continue when storage is unavailable.
    }
}

function allocateRequestKey(storageKey: string) {
    let saved: string | null = null
    try {
        saved = sessionStorage.getItem(storageKey)
    } catch {
        // Storage can be unavailable in embedded browsers.
    }
    if (saved && uuid.test(saved)) return saved
    const key = crypto.randomUUID()
    try {
        sessionStorage.setItem(storageKey, key)
    } catch {
        // The mounted invitation still retains the key for retries.
    }
    return key
}

export function FeatureReverificationFlow(props: FlowProps) {
    const owner = useAuth().user?.user.userId
    const returnTo = safeReverificationReturnTo(props.returnTo)
    return (
        <PaperworkVerificationTrackingProvider
            value={{
                flow: 'paperwork_verification',
                residence: null,
                purpose: 'reverify_for_feature',
                feature: props.feature,
            }}
        >
            {owner ? (
                <OwnedReverificationFlow
                    key={JSON.stringify([owner, props.feature, props.targetProvider, returnTo])}
                    {...props}
                    owner={owner}
                    returnTo={returnTo}
                />
            ) : (
                <VerifyLoading onBack={props.onExit} />
            )}
        </PaperworkVerificationTrackingProvider>
    )
}

function OwnedReverificationFlow({
    owner,
    feature,
    returnTo: destination,
    targetProvider,
    onExit,
}: FlowProps & { owner: string }) {
    const t = useTranslations('kyc.paperworkVerification')
    const tSetup = useTranslations('kyc.setup')
    const router = useRouter()
    const routerRef = useRef(router)
    routerRef.current = router
    const controls = useKycControl('reverify-invitation')
    const [loadVersion, setLoadVersion] = useState(0)
    const [entry, setEntry] = useState<FeatureReverificationEntry | null>()
    const [resolution, setResolution] = useState<'pending' | 'refused' | 'blocked' | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [retryAt, setRetryAt] = useState(0)
    const [allowReturn, setAllowReturn] = useState(true)
    const [startedStatus, setStartedStatus] = useState<SumsubKycStatus>()
    const candidate = useMemo(
        () => (entry?.attemptId && entry.prepared !== false ? { ...entry, attemptId: entry.attemptId } : undefined),
        [entry]
    )
    const scope = useRef<AbortController | null>(null)
    const requestKey = useRef<string | null>(null)
    const pending = useRef(false)
    const reconciling = useRef(false)
    const storageKey = 'kyc:feature-reverification:' + JSON.stringify([owner, feature])
    const resumeKey = storageKey + ':' + JSON.stringify([targetProvider ?? null, destination])

    useLayoutEffect(() => {
        const controller = new AbortController()
        scope.current = controller
        return () => controller.abort()
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        const fence = captureSessionFence(owner, () => !controller.signal.aborted)
        setEntry(undefined)
        setResolution(null)
        void Promise.resolve(fence.ready)
            .then(() => (fence.current() ? findKycDocumentPlan('verify', controller.signal, feature) : null))
            .then(async (plan) => {
                if (!fence.current()) return
                const next = plan?.entry
                const saved = readResume(resumeKey)
                if (next?.attemptId && !reconciling.current) {
                    const canReturn =
                        next.feature === feature &&
                        (!saved ||
                            (saved.allowReturn &&
                                saved.entry.attemptId === next.attemptId &&
                                saved.entry.targetProvider === next.targetProvider))
                    if (next.prepared !== false) saveResume(resumeKey, next, canReturn)
                    if (next.prepared === true) {
                        requestKey.current = null
                        clearStorage(storageKey)
                    }
                    setAllowReturn(canReturn)
                    setEntry(next)
                } else if (next?.feature === feature && !reconciling.current) {
                    clearStorage(resumeKey)
                    setEntry(next)
                } else if (plan && !next && saved && !reconciling.current) {
                    setAllowReturn(saved.allowReturn)
                    setEntry(saved.entry)
                } else {
                    const report = await getKycFeatures(controller.signal)
                    if (!fence.current()) return
                    const featureState = report?.[feature]?.state
                    if (featureState === 'on' || featureState === 'ready') {
                        clearStorage(storageKey)
                        clearStorage(resumeKey)
                        routerRef.current.replace(destination ?? '/home')
                        return
                    }
                    if (featureState === 'refused') {
                        clearStorage(storageKey)
                        clearStorage(resumeKey)
                        setResolution('refused')
                    } else if (
                        featureState === 'pending' ||
                        featureState === 'setting_up' ||
                        featureState === 'action_required'
                    ) {
                        setResolution('pending')
                    }
                    setEntry(null)
                }
            })
            .catch(() => {
                if (fence.current()) setEntry(null)
            })
        return () => controller.abort()
    }, [destination, feature, loadVersion, owner, resumeKey, storageKey])

    useEffect(() => {
        if (!retryAt) return
        let timer: ReturnType<typeof setTimeout>
        const wait = () => {
            const remaining = retryAt - Date.now()
            if (remaining <= 0) setRetryAt(0)
            else timer = setTimeout(wait, Math.min(remaining, 2_147_483_647))
        }
        wait()
        return () => clearTimeout(timer)
    }, [retryAt])

    useEffect(() => {
        if (entry && !entry.attemptId) controls.trackOnce('invitation', 'open')
    }, [controls, entry])

    const start = async () => {
        const signal = scope.current?.signal
        if (!signal || signal.aborted || pending.current || !entry || candidate || Date.now() < retryAt) return
        const fence = captureSessionFence(owner, () => !signal.aborted)
        const current = fence.current
        controls.track(error ? 'retry' : 'start', 'tap')
        pending.current = true
        setBusy(true)
        setError(null)
        try {
            if (fence.ready) await fence.ready
            if (!current()) return
            requestKey.current ??= allocateRequestKey(storageKey)
            const result = await startFeatureReverification(feature, requestKey.current, current)
            if (!current()) return
            if ('entry' in result) {
                const canReturn =
                    result.entry.feature === feature && result.entry.targetProvider === entry.targetProvider
                if (isFeatureReverificationOutcome(result.status)) {
                    requestKey.current = null
                    clearStorage(storageKey)
                    clearStorage(resumeKey)
                    if (result.status === 'APPROVED') {
                        router.replace(
                            canReturn && (!targetProvider || targetProvider === result.entry.targetProvider)
                                ? (destination ?? '/home')
                                : '/home'
                        )
                        setEntry(undefined)
                    } else {
                        setResolution('refused')
                    }
                    return
                }
                if (result.entry.prepared !== false) {
                    saveResume(resumeKey, result.entry, canReturn)
                    requestKey.current = null
                    clearStorage(storageKey)
                }
                setStartedStatus(candidateDocumentStatus(result.status))
                setAllowReturn(canReturn)
                setEntry(result.entry)
            } else {
                const { status, code } = result
                if (status && status >= 400 && status < 500 && ![408, 425, 429].includes(status)) {
                    requestKey.current = null
                    clearStorage(storageKey)
                    clearStorage(resumeKey)
                    setError(result.error || null)
                    if (
                        code === refusalCode ||
                        (code === 'reverification_finished' && result.outcome && result.outcome !== 'APPROVED')
                    ) {
                        setResolution('refused')
                    } else if (code && RECONCILE_CODES.includes(code)) {
                        reconciling.current = true
                        setEntry(undefined)
                        setLoadVersion((version) => version + 1)
                    } else {
                        setResolution('blocked')
                    }
                } else {
                    setError(result.error || t('loadFailed.description'))
                    if (status === 503) setRetryAt(kycRetryDeadline(result.retryAfter))
                }
            }
        } catch {
            if (current()) setError(t('loadFailed.description'))
        } finally {
            pending.current = false
            if (!signal.aborted) setBusy(false)
        }
    }

    const goHome = () => router.replace('/home')
    if (resolution === 'refused' || resolution === 'blocked')
        return (
            <ReviewScreen
                rejection={identityRejection({ retryable: false })}
                copy={{
                    title: t(resolution === 'refused' ? 'reverify.refusalTitle' : 'loadFailed.title'),
                    description:
                        error ??
                        (resolution === 'refused'
                            ? t(`reverify.${refusalCopy[feature]}`)
                            : t('loadFailed.description')),
                }}
                onHome={goHome}
            />
        )
    if (resolution === 'pending')
        return (
            <StepsScreen
                phase="review"
                title={t('reverify.pendingTitle')}
                note={t('reverify.pendingDescription')}
                onBack={goHome}
                onContinue={goHome}
            />
        )
    if (entry === undefined) return <VerifyLoading onBack={onExit} />
    if (!entry) return <LoadFailed onRetry={() => setLoadVersion((version) => version + 1)} onHome={onExit} />

    if (candidate) {
        return (
            <PaperworkVerificationFlow
                candidate={candidate}
                startedStatus={startedStatus}
                returnTo={
                    allowReturn &&
                    candidate.feature === feature &&
                    (!targetProvider || candidate.targetProvider === targetProvider)
                        ? destination
                        : null
                }
            />
        )
    }

    return (
        <VerifyHeroLayout
            pose="thinking"
            screenId="reverify-invitation"
            title={t('reverify.inviteTitle')}
            description={t(`reverify.${invitationCopy[feature]}`)}
            onBack={onExit}
            footer={
                <VerifyFooter
                    actions={
                        <Button
                            className="w-full"
                            onClick={() => void start()}
                            disabled={busy || retryAt > 0}
                            data-testid="verify-reverification-start"
                        >
                            {error
                                ? t('loadFailed.retry')
                                : entry.attemptId
                                  ? t('continue')
                                  : tSetup('verifyAgainPlain')}
                        </Button>
                    }
                />
            }
        >
            {error && <p role="alert">{error}</p>}
        </VerifyHeroLayout>
    )
}
