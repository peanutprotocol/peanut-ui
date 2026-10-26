'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { ANALYTICS_EVENTS, type AnalyticsEvent } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import {
    getKycReplacementPlan,
    resumeKycDocumentAttempt,
    startKycDocumentReplacement,
    type KycReplacementResult,
} from '@/app/actions/kyc-workflow'
import type { KycAttemptSession, KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import type { PaperworkVerificationDocument } from '@/app/actions/types/kyc-paperwork-verification.types'
import { identityDocuments } from '@/utils/kyc-document-plan.utils'
import { DOCUMENT_KEYS, IdentityDocumentScreen } from './components/IdentityDocumentScreen'
import { LoadFailed, VerifyLoading } from './components/LoadScreens'
import { ReviewScreen } from './components/StatusScreens'
import {
    trackPaperworkVerification,
    PaperworkVerificationTrackingProvider,
    type PaperworkVerificationTrackingContext,
} from './analytics'

const STEPS = ['id', 'review'] as const
type RestartStep = (typeof STEPS)[number]

const newRequestKey = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')

// Sumsub has no temporary protection type; the host country's residence permit stands in, as on the first check.
const sumsubDocumentType = (type: string) => (type === 'TEMPORARY_PROTECTION' ? 'RESIDENCE_PERMIT' : type)

type Failure = Extract<KycReplacementResult, { kind: 'failed' }>

/**
 * /verify?step=id&restart=1: a new identity check for a user verified through
 * a verification attempt. The ID screen picks the document, the restart
 * replaces the identity on it (a Smart Paperwork Verification identity stays on it),
 * Sumsub takes the photos and the selfie, and the review screen follows.
 */
export function IdentityRestartFlow({ onExit }: { onExit: () => void }) {
    const router = useRouter()
    const [state, setState] = useState<
        { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; plan: KycDocumentPlan }
    >({ kind: 'loading' })
    // A load must not re-run because the router object changed identity.
    const routerRef = useRef(router)
    routerRef.current = router

    const load = useCallback(async () => {
        setState({ kind: 'loading' })
        try {
            const plan = await getKycReplacementPlan()
            // Every other identity restarts through today's flow, which starts from Home.
            if (!plan) {
                routerRef.current.replace('/home')
                return
            }
            setState({ kind: 'ready', plan })
        } catch {
            trackPaperworkVerification(
                { flow: 'paperwork_verification', residence: null, restart: true },
                ANALYTICS_EVENTS.KYC_PV_LOAD_FAILED
            )
            setState({ kind: 'failed' })
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    if (state.kind === 'loading') return <VerifyLoading onBack={onExit} />
    if (state.kind === 'failed') return <LoadFailed onRetry={() => void load()} onHome={() => router.push('/home')} />
    return <RestartSteps plan={state.plan} onExit={onExit} />
}

function RestartSteps({ plan, onExit }: { plan: KycDocumentPlan; onExit: () => void }) {
    const t = useTranslations('kyc')
    const tCooldown = useTranslations('profile.unlockPayments.cooldown')
    const locale = useLocale()
    const router = useRouter()
    const { user } = useAuth()
    const residence = user?.residence?.declared ?? null
    const [submitted, setSubmitted] = useState(false)
    const [busy, setBusy] = useState(false)
    const [identityStepTitle, setIdentityStepTitle] = useState<string>()
    const [error, setError] = useState<string | null>(null)
    const [session, setSession] = useState<KycAttemptSession | null>(null)
    const busyRef = useRef(false)
    const sessionRef = useRef<KycAttemptSession | null>(null)
    const requestKeyRef = useRef<string | null>(null)

    const stepper = useFlowStepper<RestartStep>({
        steps: [...STEPS],
        defaultStep: 'id',
        guards: { review: { ok: submitted } },
        onExit,
    })
    const step = stepper.step

    const tracking = useMemo<PaperworkVerificationTrackingContext>(
        () => ({ flow: 'paperwork_verification', residence, features: plan.features, restart: true }),
        [residence, plan.features]
    )
    const track = (event: AnalyticsEvent, properties?: Record<string, unknown>) =>
        trackPaperworkVerification(tracking, event, properties)

    useEffect(() => {
        if (step === 'review')
            trackPaperworkVerification(tracking, ANALYTICS_EVENTS.KYC_PV_REVIEW_VIEWED, { status: 'PENDING' })
        // A screen view per step change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step])

    const failureMessage = (failure: Failure) => {
        if (failure.cooldown)
            return failure.cooldown.retryAt
                ? tCooldown('until', {
                      until: new Date(failure.cooldown.retryAt).toLocaleString(locale, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                      }),
                  })
                : tCooldown('short')
        // A coded failure is the action's own English fallback; a codeless one is the API's display-ready message.
        return failure.error && !failure.code ? failure.error : t('errorRestartFailed')
    }

    const replace = async (document: PaperworkVerificationDocument) => {
        const route = plan.routes[0]
        const identity = identityDocuments(route)[0]
        if (busyRef.current || !route || !identity || !plan.policyVersion) return
        busyRef.current = true
        setBusy(true)
        setIdentityStepTitle(t(`documents.${DOCUMENT_KEYS[document.type as keyof typeof DOCUMENT_KEYS]}`))
        setError(null)
        requestKeyRef.current ??= newRequestKey()
        try {
            const result = await startKycDocumentReplacement({
                requestKey: requestKeyRef.current,
                policyVersion: plan.policyVersion,
                routeId: route.id,
                documents: [
                    {
                        key: identity.key,
                        type: sumsubDocumentType(document.type),
                        issuingCountry: document.issuingCountry,
                    },
                ],
            })
            track(ANALYTICS_EVENTS.KYC_PV_ID_OUTCOME, {
                outcome: result.kind === 'session' ? 'opened' : 'failed',
                ...(result.kind === 'failed' && { cooldown: !!result.cooldown }),
            })
            if (result.kind === 'session') {
                sessionRef.current = result.session
                setSession(result.session)
            } else {
                // A failed restart can close the attempt its key reserved; the next try reserves a new one.
                requestKeyRef.current = null
                setError(failureMessage(result))
            }
        } finally {
            busyRef.current = false
            setBusy(false)
        }
    }

    const refreshToken = useCallback(async () => {
        const current = sessionRef.current
        if (!current) throw new Error('No verification session')
        const next = await resumeKycDocumentAttempt(current.attemptId)
        if (sessionRef.current !== current) throw new Error('Verification session closed')
        sessionRef.current = { ...current, token: next.token }
        setSession(sessionRef.current)
        return next.token
    }, [])

    const closeSession = () => {
        sessionRef.current = null
        setSession(null)
    }

    return (
        <PaperworkVerificationTrackingProvider value={tracking}>
            {step === 'review' ? (
                <ReviewScreen failed={false} onHome={() => router.push('/home')} />
            ) : (
                <IdentityDocumentScreen
                    plan={plan}
                    residence={residence}
                    restart
                    busy={busy}
                    error={error}
                    onBack={() => void stepper.back()}
                    onContinue={(document) => void replace(document)}
                />
            )}
            <SumsubKycWrapper
                visible={!!session}
                accessToken={session?.token ?? null}
                documentConfig={session?.sdkConfig}
                sessionKey={session?.attemptId}
                preselection="preferred"
                identityStepTitle={identityStepTitle}
                onClose={() => {
                    track(ANALYTICS_EVENTS.KYC_PV_IDENTITY_CLOSED)
                    closeSession()
                }}
                onComplete={() => {
                    track(ANALYTICS_EVENTS.KYC_PV_IDENTITY_SUBMITTED)
                    closeSession()
                    setSubmitted(true)
                    void stepper.goTo('review')
                }}
                onRefreshToken={refreshToken}
            />
        </PaperworkVerificationTrackingProvider>
    )
}
