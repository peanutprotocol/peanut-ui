'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { startFeatureReverification } from '@/app/actions/kyc-reverification'
import { findKycDocumentPlan, candidateDocumentStatus } from '@/app/actions/kyc-workflow'
import { captureSessionFence } from '@/utils/session-fence'
import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type { PaperworkVerificationFeature } from '@/app/actions/types/kyc-paperwork-verification.types'
import type { FeatureReverificationEntry } from '@/app/actions/types/kyc-reverification.types'
import { isFeatureReverificationEntry, safeReverificationReturnTo } from '@/utils/kyc-reverification'
import { LoadFailed, VerifyLoading } from './components/LoadScreens'
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
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

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
                <OwnedReverificationFlow key={JSON.stringify([owner, props.feature])} {...props} owner={owner} />
            ) : (
                <VerifyLoading onBack={props.onExit} />
            )}
        </PaperworkVerificationTrackingProvider>
    )
}

function OwnedReverificationFlow({ owner, feature, returnTo, targetProvider, onExit }: FlowProps & { owner: string }) {
    const t = useTranslations('kyc.paperworkVerification')
    const controls = useKycControl('reverify-invitation')
    const [loadVersion, setLoadVersion] = useState(0)
    const [entry, setEntry] = useState<FeatureReverificationEntry | null>()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [allowReturn, setAllowReturn] = useState(true)
    const [startedStatus, setStartedStatus] = useState<SumsubKycStatus>()
    const candidate = useMemo(() => (entry?.attemptId ? { ...entry, attemptId: entry.attemptId } : undefined), [entry])
    const scope = useRef<AbortController | null>(null)
    const requestKey = useRef<string | null>(null)
    const pending = useRef(false)
    const storageKey = 'kyc:feature-reverification:' + JSON.stringify([owner, feature])
    const resumeKey = storageKey + ':' + JSON.stringify([targetProvider ?? null, safeReverificationReturnTo(returnTo)])

    useLayoutEffect(() => {
        const controller = new AbortController()
        scope.current = controller
        return () => controller.abort()
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        const fence = captureSessionFence(owner, () => !controller.signal.aborted)
        setEntry(undefined)
        void Promise.resolve(fence.ready)
            .then(() => (fence.current() ? findKycDocumentPlan('verify', controller.signal, feature) : null))
            .then((plan) => {
                if (!fence.current()) return
                const next = plan?.entry
                const saved = readResume(resumeKey)
                if (next?.attemptId) {
                    const canReturn =
                        next.feature === feature &&
                        (!saved ||
                            (saved.allowReturn &&
                                saved.entry.attemptId === next.attemptId &&
                                saved.entry.targetProvider === next.targetProvider))
                    saveResume(resumeKey, next, canReturn)
                    try {
                        sessionStorage.removeItem(storageKey)
                    } catch {
                        // The server's active entry remains the source of truth on reload.
                    }
                    setAllowReturn(canReturn)
                    setEntry(next)
                } else if (next?.feature === feature) {
                    try {
                        sessionStorage.removeItem(resumeKey)
                    } catch {
                        // A fresh invitation takes precedence over any saved candidate.
                    }
                    setEntry(next)
                } else if (plan && !next && saved) {
                    setAllowReturn(saved.allowReturn)
                    setEntry(saved.entry)
                } else {
                    setEntry(null)
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) setEntry(null)
            })
        return () => controller.abort()
    }, [feature, loadVersion, owner, resumeKey, storageKey])

    useEffect(() => {
        if (entry && !entry.attemptId) controls.trackOnce('invitation', 'open')
    }, [controls, entry])

    const start = async () => {
        const signal = scope.current?.signal
        if (!signal || signal.aborted || pending.current || !entry || entry.attemptId) return
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
                saveResume(resumeKey, result.entry, canReturn)
                setStartedStatus(candidateDocumentStatus(result.status))
                setAllowReturn(canReturn)
                setEntry(result.entry)
                try {
                    sessionStorage.removeItem(storageKey)
                } catch {
                    // The server's active entry remains the source of truth on reload.
                }
            } else {
                setError(result.error || t('loadFailed.description'))
            }
        } catch {
            if (current()) setError(t('loadFailed.description'))
        } finally {
            pending.current = false
            if (!signal.aborted) setBusy(false)
        }
    }

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
                        ? safeReverificationReturnTo(returnTo)
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
                            disabled={busy}
                            data-testid="verify-reverification-start"
                        >
                            {t(error ? 'loadFailed.retry' : 'reverify.start')}
                        </Button>
                    }
                />
            }
        >
            {error && <p role="alert">{error}</p>}
        </VerifyHeroLayout>
    )
}
