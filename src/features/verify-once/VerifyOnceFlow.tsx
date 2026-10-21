'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Loading from '@/components/Global/Loading'
import ResidenceChangeDrawer from '@/components/Profile/views/ResidenceChangeDrawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useAuth } from '@/context/authContext'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useWebSocket } from '@/hooks/useWebSocket'
import { getKycQuestions, saveVerifyOnceFeatures, skipProofOfAddress } from '@/app/actions/kyc-verify-once'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type {
    VerifyOnceAnswers,
    VerifyOnceQuestions,
    VerifyOnceStepId,
} from '@/app/actions/types/kyc-verify-once.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { localizedCountryName } from '@/utils/country-name.utils'
import { Button } from '@/components/0_Bruddle/Button'
import { IdentityDocumentScreen } from './components/IdentityDocumentScreen'
import { QuestionStepScreen } from './components/QuestionStepScreen'
import { ProofOfAddressScreen, ReviewScreen, VerifiedScreen } from './components/StatusScreens'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'
import { trackVerifyOnce, VerifyOnceTrackingProvider, type VerifyOnceTrackingContext } from './analytics'
import { isVerifyOnceEnabled } from './verifyOnceFlag'
import { useVerifyOnceIdentity } from './useVerifyOnceIdentity'
import {
    entryStep,
    FAILED_STATUSES,
    IN_REVIEW_STATUSES,
    markSaved,
    phoneJoinsAddress,
    RESIDENCE_CHANGE_HREF,
    resumeStep,
    screenIds,
    stepProgress,
    type VerifyStep,
} from './verifyOnce.utils'
import type { AnswerFormError } from './useAnswerForm'

const STATUS_POLL_MS = 15_000

type Loaded = { questions: VerifyOnceQuestions; plan: KycDocumentPlan | null; status: SumsubKycStatus | undefined }

function LoadFailed({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
    const t = useTranslations('kyc.verifyOnce')
    return (
        <VerifyHeroLayout
            pose="sad"
            title={t('loadFailed.title')}
            description={t('loadFailed.description')}
            footer={
                <VerifyFooter
                    actions={
                        <Button shadowSize="4" className="w-full" onClick={onRetry} data-testid="verify-retry-load">
                            {t('loadFailed.retry')}
                        </Button>
                    }
                    secondary={
                        <Button variant="secondary" shadowSize="4" className="w-full" onClick={onHome}>
                            {t('review.cta')}
                        </Button>
                    }
                />
            }
        />
    )
}

/**
 * /verify: the verify-once identity check. Peanut asks the questions the
 * signup features need (each Continue writes them to Sumsub), then the
 * midpoint picks the ID, then Sumsub takes the photos and the selfie. The
 * server is the source of truth for every answer and for where to resume.
 */
export function VerifyOnceFlow() {
    const router = useRouter()
    const [state, setState] = useState<{ kind: 'loading' } | { kind: 'failed' } | ({ kind: 'ready' } & Loaded)>({
        kind: 'loading',
    })
    const [generation, setGeneration] = useState(0)
    // A load must not re-run because the router object changed identity.
    const routerRef = useRef(router)
    routerRef.current = router

    const load = useCallback(async () => {
        setState({ kind: 'loading' })
        try {
            const [questions, plan, status] = await Promise.all([
                getKycQuestions(),
                findKycDocumentPlan(),
                getKycDocumentStatus().catch(() => undefined),
            ])
            // Flag off, a stale link or a user the server keeps on today's flow: that flow starts from Home.
            if (!isVerifyOnceEnabled() || !questions.available || plan?.flow !== 'verify-once') {
                routerRef.current.replace('/home')
                return
            }
            setState({ kind: 'ready', questions, plan, status })
            setGeneration((g) => g + 1)
        } catch {
            trackVerifyOnce({ flow: 'verify_once', residence: null }, ANALYTICS_EVENTS.KYC_VO_LOAD_FAILED)
            setState({ kind: 'failed' })
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    if (state.kind === 'loading')
        return (
            <div className="flex h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] w-full items-center justify-center bg-white">
                <Loading variant="mascot" />
            </div>
        )
    if (state.kind === 'failed') return <LoadFailed onRetry={() => void load()} onHome={() => router.push('/home')} />
    return <VerifyOnceSteps key={generation} initial={state} reload={load} />
}

function VerifyOnceSteps({ initial, reload }: { initial: Loaded; reload: () => Promise<void> }) {
    const t = useTranslations('kyc.verifyOnce')
    const locale = useLocale()
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const exit = useSafeBack('/home')
    const [questions, setQuestions] = useState(initial.questions)
    const [plan, setPlan] = useState(initial.plan)
    const [status, setStatus] = useState(initial.status)
    const [submitted, setSubmitted] = useState(false)
    const [idError, setIdError] = useState<string | null>(null)
    const [documentRequired, setDocumentRequired] = useState(false)
    const identity = useVerifyOnceIdentity()
    // Decided once per load, so Back shows the same screens the user came through.
    const [phoneJoined] = useState(() => phoneJoinsAddress(initial.questions))
    const screenOf = (id: VerifyStep): VerifyStep => (phoneJoined && id === 'phone' ? 'address' : id)

    const questionIds = useMemo(() => screenIds(questions, phoneJoined), [questions, phoneJoined])
    const steps = useMemo<VerifyStep[]>(
        () => [...questionIds, 'id', 'review', 'verified', 'address-proof'],
        [questionIds]
    )
    const allAnswered = questions.steps.every((s) => s.answered)
    const approved = status === 'APPROVED'
    const failed = !!status && FAILED_STATUSES.has(status)
    const reviewing = submitted || (!!status && IN_REVIEW_STATUSES.has(status))
    const asking = !approved && !reviewing && !failed
    const entry = screenOf(entryStep({ questions, plan, status }, submitted))

    const stepper = useFlowStepper<VerifyStep>({
        steps,
        defaultStep: entry,
        guards: {
            ...Object.fromEntries(questionIds.map((id) => [id, { ok: asking }])),
            id: { ok: asking && (allAnswered || documentRequired) },
            review: { ok: reviewing || failed },
            verified: { ok: approved },
            'address-proof': { ok: approved && plan?.proofOfAddress === 'suggested' },
        },
        backMap: questionIds.length ? { id: questionIds[questionIds.length - 1] } : undefined,
        onExit: exit,
    })
    const step = stepper.step
    const goToStep = stepper.goTo

    const afterSave = async (saved: VerifyOnceStepId[], next: VerifyOnceStepId | null, values: VerifyOnceAnswers) => {
        const updated = saved.reduce((current, id) => markSaved(current, id, values), questions)
        setQuestions(updated)
        const last = saved[saved.length - 1]
        const following =
            (next && updated.steps.some((s) => s.id === next && !s.answered) ? next : null) ??
            updated.steps.slice(updated.steps.findIndex((s) => s.id === last) + 1).find((s) => !s.answered)?.id ??
            updated.steps.find((s) => !s.answered)?.id
        if (following) {
            void stepper.goTo(screenOf(following))
            return
        }
        // The last answer reserves the attempt: read it back before the midpoint needs it.
        try {
            const fresh = await getKycQuestions()
            setQuestions(fresh)
            const open = resumeStep(fresh)
            void stepper.goTo(open ? screenOf(open) : 'id')
        } catch {
            void stepper.goTo('id')
        }
    }

    const onConflict = (error: AnswerFormError) => {
        // Not (or no longer) a verify-once user: today's flow starts from Home.
        if (error === 'unavailable' || error === 'existing_verification') router.replace('/home')
        // Another device submitted the ID, or the features changed: the server rebuilds the questions.
        else if (error === 'identity_submitted' || error === 'feature_not_selected') void reload()
    }

    const startIdentity = async (document?: { type: string; issuingCountry: string }) => {
        setIdError(null)
        let attemptId = identity.attemptIdRef.current ?? questions.attemptId ?? plan?.activeAttemptId ?? null
        if (!attemptId) {
            const fresh = await getKycQuestions().catch(() => null)
            if (fresh) setQuestions(fresh)
            attemptId = fresh?.attemptId ?? null
        }
        if (!attemptId) {
            setIdError(t('midpoint.failed'))
            return
        }
        const outcome = await identity.open(attemptId, document)
        if (outcome.kind !== 'busy')
            track(ANALYTICS_EVENTS.KYC_VO_ID_OUTCOME, {
                outcome: outcome.kind,
                retry: !document,
                ...(outcome.kind === 'questions-missing' && { missing_step: outcome.step }),
            })
        if (outcome.kind === 'opened') setQuestions((current) => ({ ...current, attemptId: outcome.attemptId }))
        if (outcome.kind === 'document-required') {
            setDocumentRequired(true)
            setStatus('NOT_STARTED')
            setSubmitted(false)
            void stepper.goTo('id')
        }
        if (outcome.kind === 'failed') setIdError(t('midpoint.failed'))
        if (outcome.kind === 'questions-missing') {
            setDocumentRequired(false)
            setStatus('NOT_STARTED')
            setSubmitted(false)
            const fresh = await getKycQuestions().catch(() => null)
            if (fresh) setQuestions(fresh)
            const target = outcome.step ?? (fresh && resumeStep(fresh))
            if (target) void stepper.goTo(screenOf(target))
        }
    }

    useEffect(() => {
        const attemptId = identity.session?.attemptId
        if (attemptId)
            setQuestions((current) => (current.attemptId === attemptId ? current : { ...current, attemptId }))
    }, [identity.session?.attemptId])

    useEffect(() => {
        if (!identity.documentRequired) return
        setDocumentRequired(true)
        setStatus('NOT_STARTED')
        setSubmitted(false)
        void goToStep('id')
    }, [identity.documentRequired, goToStep])

    const continueWithoutLocal = async () => {
        const currentPlan = await findKycDocumentPlan()
        if (!currentPlan) throw new Error('KYC plan unavailable')
        const result = await saveVerifyOnceFeatures({ ...currentPlan.features, local: false })
        if (result.kind === 'failed') throw new Error('KYC preferences not saved')
        await reload()
    }

    // The review result arrives on the websocket; the read-only status poll covers a missed event.
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onSumsubKycStatusUpdate: (next) => setStatus(next as SumsubKycStatus),
    })
    useEffect(() => {
        if (step !== 'review' || failed) return
        const timer = setInterval(() => {
            void getKycDocumentStatus()
                .then((next) => next && setStatus(next))
                .catch(() => {})
        }, STATUS_POLL_MS)
        return () => clearInterval(timer)
    }, [step, failed])
    const approvalHandled = useRef(false)
    useEffect(() => {
        if (!approved || step !== 'review' || approvalHandled.current) return
        approvalHandled.current = true
        void fetchUser()
        void findKycDocumentPlan().then((fresh) => {
            if (fresh) setPlan(fresh)
            void stepper.goTo(fresh?.proofOfAddress === 'suggested' ? 'address-proof' : 'verified')
        })
    }, [approved, step, fetchUser, stepper])

    const tracking = useMemo<VerifyOnceTrackingContext>(
        () => ({ flow: 'verify_once', residence: questions.residence, features: plan?.features }),
        [questions.residence, plan?.features]
    )
    const track = (event: Parameters<typeof trackVerifyOnce>[1], properties?: Record<string, unknown>) =>
        trackVerifyOnce(tracking, event, properties)
    useEffect(() => {
        track(ANALYTICS_EVENTS.KYC_VO_VIEWED, {
            entry,
            question_screens: questionIds.length,
            answered_steps: questions.steps.filter((s) => s.answered).length,
            phone_on_address: phoneJoined,
            status: status ?? null,
        })
        // Once per load: a reload remounts this component.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    useEffect(() => {
        if (step === 'review') track(ANALYTICS_EVENTS.KYC_VO_REVIEW_VIEWED, { status: status ?? null })
        if (step === 'verified') track(ANALYTICS_EVENTS.KYC_VO_VERIFIED_VIEWED)
        if (step === 'address-proof') track(ANALYTICS_EVENTS.KYC_VO_POA_VIEWED)
        // A screen view per step change, and per review status while the review is in view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, step === 'review' ? status : null])
    const [residenceOpen, setResidenceOpen] = useState(false)
    // Mounted from the first opening on: its restriction fetch only runs for a user who asks to move.
    const [residenceMounted, setResidenceMounted] = useState(false)

    const goHome = () => router.push('/home')
    const residenceName = questions.residence
        ? localizedCountryName(locale, questions.residence, questions.residence)
        : ''

    const current = questions.steps.find((s) => s.id === step)
    const phone = questions.steps.find((s) => s.id === 'phone')
    let screen: React.ReactNode = null
    if (current) {
        const shown = phoneJoined && current.id === 'address' && phone ? [current, phone] : [current]
        screen = (
            <QuestionStepScreen
                key={current.id}
                steps={shown}
                residence={questions.residence}
                progress={stepProgress(questionIds, current.id)}
                onBack={() => void stepper.back()}
                onSaved={(next, values) =>
                    void afterSave(
                        shown.map((s) => s.id),
                        next,
                        values
                    )
                }
                onConflict={onConflict}
                onContinueWithoutLocal={continueWithoutLocal}
                onChangeResidence={() => {
                    setResidenceMounted(true)
                    setResidenceOpen(true)
                }}
            />
        )
    } else if (step === 'id') {
        const total = questionIds.length + 2
        screen = (
            <IdentityDocumentScreen
                plan={plan}
                residence={questions.residence}
                progress={{ current: total, total }}
                busy={identity.busy}
                error={idError}
                onBack={() => void stepper.back()}
                onContinue={(document) => void startIdentity(document)}
            />
        )
    } else if (step === 'review') {
        screen = (
            <ReviewScreen
                failed={failed}
                onHome={goHome}
                onRetry={
                    status === 'ACTION_REQUIRED'
                        ? () => {
                              track(ANALYTICS_EVENTS.KYC_VO_REVIEW_RETRY)
                              void startIdentity()
                          }
                        : undefined
                }
                busy={identity.busy}
                error={idError}
            />
        )
    } else if (step === 'verified') {
        screen = <VerifiedScreen onHome={goHome} />
    } else if (step === 'address-proof') {
        screen = (
            <ProofOfAddressStep
                residenceName={residenceName}
                onDone={(outcome) => {
                    track(
                        outcome === 'skipped'
                            ? ANALYTICS_EVENTS.KYC_VO_POA_SKIPPED
                            : ANALYTICS_EVENTS.KYC_VO_POA_UPLOADED
                    )
                    void stepper.goTo('verified')
                }}
                onUploadStarted={() => track(ANALYTICS_EVENTS.KYC_VO_POA_UPLOAD_STARTED)}
            />
        )
    }

    return (
        <VerifyOnceTrackingProvider value={tracking}>
            {screen}
            {residenceMounted && (
                <ResidenceChangeDrawer
                    visible={residenceOpen}
                    onClose={() => setResidenceOpen(false)}
                    userId={user?.user.userId}
                    declared={user?.residence?.declared ?? questions.residence}
                    declaredSecond={user?.residence?.declaredSecond}
                    verified={user?.residence?.verified ?? null}
                    pending={user?.residence?.pending ?? null}
                    onSaved={async () => {
                        // The questions follow the residence: the server rebuilds them for the new country.
                        await fetchUser()
                        await reload()
                    }}
                    onReverify={() => router.push(RESIDENCE_CHANGE_HREF)}
                />
            )}
            <SumsubKycWrapper
                visible={!!identity.session}
                accessToken={identity.session?.token ?? null}
                documentConfig={identity.session?.sdkConfig}
                sessionKey={identity.session?.attemptId}
                preselection="preferred"
                onClose={() => {
                    track(ANALYTICS_EVENTS.KYC_VO_IDENTITY_CLOSED)
                    identity.close()
                }}
                onComplete={() => {
                    track(ANALYTICS_EVENTS.KYC_VO_IDENTITY_SUBMITTED)
                    identity.close()
                    setStatus('PENDING')
                    setSubmitted(true)
                    void stepper.goTo('review')
                }}
                onRefreshToken={identity.refreshToken}
            />
        </VerifyOnceTrackingProvider>
    )
}

/** Rule 1's upload goes through the existing supplement action (`supplement:bridge`). */
function ProofOfAddressStep({
    residenceName,
    onDone,
    onUploadStarted,
}: {
    residenceName: string
    onDone: (outcome: 'uploaded' | 'skipped') => void
    onUploadStarted: () => void
}) {
    const flow = useSumsubKycFlow({ onKycSuccess: () => onDone('uploaded') })
    return (
        <>
            <ProofOfAddressScreen
                residenceName={residenceName}
                uploading={flow.isLoading}
                error={flow.error}
                onUpload={() => {
                    onUploadStarted()
                    void flow.handleStartAction('supplement:bridge')
                }}
                onSkip={() => {
                    // Best effort: a failed save only means the suggestion can come back next visit.
                    void skipProofOfAddress()
                    onDone('skipped')
                }}
            />
            <SumsubKycWrapper
                visible={flow.showWrapper}
                accessToken={flow.accessToken}
                onClose={flow.handleClose}
                onComplete={() => {
                    flow.handleSdkComplete()
                    onDone('uploaded')
                }}
                onRefreshToken={flow.refreshToken}
            />
        </>
    )
}
