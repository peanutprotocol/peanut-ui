'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useLocale, useTranslations } from 'next-intl'
import ResidenceChangeDrawer from '@/components/Profile/views/ResidenceChangeDrawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useAuth } from '@/context/authContext'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
    getKycQuestions,
    savePaperworkVerificationFeatures,
    skipProofOfAddress,
} from '@/app/actions/kyc-paperwork-verification'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationQuestions,
    PaperworkVerificationStepId,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import {
    PAPERWORK_VERIFICATION_FLOW,
    type KycDocumentPlan,
    type KycPlanNeed,
} from '@/app/actions/types/kyc-workflow.types'
import { localizedCountryName } from '@/utils/country-name.utils'
import { IdentityDocumentScreen } from './components/IdentityDocumentScreen'
import { QuestionStepScreen } from './components/QuestionStepScreen'
import { LoadFailed, VerifyLoading } from './components/LoadScreens'
import { VerifySetupPrelude } from './components/VerifySetupPrelude'
import {
    ProofOfAddressScreen,
    ReviewScreen,
    SavedScreen,
    StepsScreen,
    VerifiedScreen,
} from './components/StatusScreens'
import {
    trackPaperworkVerification,
    PaperworkVerificationTrackingProvider,
    type PaperworkVerificationTrackingContext,
} from './analytics'
import { usePaperworkVerificationIdentity } from './usePaperworkVerificationIdentity'
import {
    citizenshipOf,
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
} from './paperworkVerification.utils'
import type { AnswerFormError } from './useAnswerForm'

const STATUS_POLL_MS = 15_000

type Loaded = {
    questions: PaperworkVerificationQuestions
    plan: KycDocumentPlan | null
    status: SumsubKycStatus | undefined
}

/**
 * /verify: the Smart Paperwork Verification identity check. Peanut asks the questions the
 * signup features need (each Continue writes them to Sumsub), then the
 * midpoint picks the ID, then Sumsub takes the photos and the selfie. The
 * server is the source of truth for every answer and for where to resume.
 */
export function PaperworkVerificationFlow() {
    const router = useRouter()
    const [state, setState] = useState<
        | { kind: 'loading' }
        | { kind: 'failed' }
        | { kind: 'setup'; needs: KycPlanNeed[] }
        | ({ kind: 'ready' } & Loaded)
    >({
        kind: 'loading',
    })
    const exit = useSafeBack('/home')
    const [generation, setGeneration] = useState(0)
    // The steps overview opens a visit once; a reload mid-flow goes straight back to the open step.
    const introShown = useRef(false)
    // A load must not re-run because the router object changed identity.
    const routerRef = useRef(router)
    routerRef.current = router

    const load = useCallback(async () => {
        setState({ kind: 'loading' })
        try {
            const [questions, plan, status] = await Promise.all([
                // an older account the questions cannot be built for yet answers the setup screens first
                getKycQuestions().catch(() => null),
                // a plan that cannot be read throws: the retry screen, not Home
                findKycDocumentPlan('verify'),
                getKycDocumentStatus().catch(() => undefined),
            ])
            if (plan?.flow === PAPERWORK_VERIFICATION_FLOW && plan.needs?.length) {
                setState({ kind: 'setup', needs: plan.needs })
                return
            }
            if (!questions) throw new Error('KYC questions unavailable')
            // A stale link or a user the server keeps on today's flow: that flow starts from Home.
            if (!questions.available || plan?.flow !== PAPERWORK_VERIFICATION_FLOW) {
                routerRef.current.replace('/home')
                return
            }
            setState({ kind: 'ready', questions, plan, status })
            setGeneration((g) => g + 1)
        } catch {
            trackPaperworkVerification(
                { flow: 'paperwork_verification', residence: null },
                ANALYTICS_EVENTS.KYC_PV_LOAD_FAILED
            )
            setState({ kind: 'failed' })
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    if (state.kind === 'loading') return <VerifyLoading />
    if (state.kind === 'failed') return <LoadFailed onRetry={() => void load()} onHome={() => router.push('/home')} />
    if (state.kind === 'setup') return <VerifySetupPrelude needs={state.needs} onDone={load} onExit={exit} />
    return <PaperworkVerificationSteps key={generation} initial={state} reload={load} introShown={introShown} />
}

function PaperworkVerificationSteps({
    initial,
    reload,
    introShown,
}: {
    initial: Loaded
    reload: () => Promise<void>
    introShown: React.MutableRefObject<boolean>
}) {
    const t = useTranslations('kyc.paperworkVerification')
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
    const identity = usePaperworkVerificationIdentity()
    // Decided once per load, so Back shows the same screens the user came through.
    const [phoneJoined] = useState(() => phoneJoinsAddress(initial.questions))
    const screenOf = (id: VerifyStep): VerifyStep => (phoneJoined && id === 'phone' ? 'address' : id)

    const questionIds = useMemo(() => screenIds(questions, phoneJoined), [questions, phoneJoined])
    const steps = useMemo<VerifyStep[]>(
        () => [...questionIds, 'saved', 'id', 'review', 'verified', 'address-proof'],
        [questionIds]
    )
    const allAnswered = questions.steps.every((s) => s.answered)
    const approved = status === 'APPROVED'
    const failed = !!status && FAILED_STATUSES.has(status)
    const reviewing = submitted || (!!status && IN_REVIEW_STATUSES.has(status))
    const asking = !approved && !reviewing && !failed
    const entry = screenOf(entryStep({ questions, plan, status }, submitted))

    // A visit that still has questions or the ID ahead opens on the steps overview, in front
    // of the open step; a deep link to a step skips it.
    const [stepParam] = useQueryState('step')
    const [intro, setIntro] = useState(() => asking && !introShown.current && !stepParam)
    const showIntro = intro && asking
    // While asking, the clean URL keeps meaning the step this visit opened on, so moving on to
    // a step that has since become the entry (the ID, once every answer is in) still writes it.
    const [openedOn] = useState(entry)
    const stepper = useFlowStepper<VerifyStep>({
        steps,
        defaultStep: asking ? openedOn : entry,
        guards: {
            ...Object.fromEntries(questionIds.map((id) => [id, { ok: asking }])),
            saved: { ok: asking && allAnswered },
            id: { ok: asking && (allAnswered || documentRequired) },
            review: { ok: reviewing || failed },
            verified: { ok: approved },
            'address-proof': { ok: approved && plan?.proofOfAddress === 'suggested' },
        },
        // Back from the ID skips the saved celebration.
        backMap: questionIds.length ? { id: questionIds[questionIds.length - 1] } : undefined,
        // Back from the first screen returns to the overview, when this visit showed it.
        onExit: () => (asking && introShown.current ? setIntro(true) : exit()),
    })
    const step = stepper.step
    const goToStep = stepper.goTo
    useEffect(() => {
        if (showIntro) introShown.current = true
    }, [showIntro, introShown])

    const afterSave = async (
        saved: PaperworkVerificationStepId[],
        next: PaperworkVerificationStepId | null,
        values: PaperworkVerificationAnswers
    ) => {
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
            void stepper.goTo(open ? screenOf(open) : 'saved')
        } catch {
            void stepper.goTo('saved')
        }
    }

    const onConflict = (error: AnswerFormError) => {
        // Not (or no longer) a Smart Paperwork Verification user: today's flow starts from Home.
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
            track(ANALYTICS_EVENTS.KYC_PV_ID_OUTCOME, {
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
        const result = await savePaperworkVerificationFeatures({ ...currentPlan.features, local: false })
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
        void findKycDocumentPlan()
            .catch(() => null)
            .then((fresh) => {
                if (fresh) setPlan(fresh)
                void stepper.goTo(fresh?.proofOfAddress === 'suggested' ? 'address-proof' : 'verified')
            })
    }, [approved, step, fetchUser, stepper])

    const tracking = useMemo<PaperworkVerificationTrackingContext>(
        () => ({ flow: 'paperwork_verification', residence: questions.residence, features: plan?.features }),
        [questions.residence, plan?.features]
    )
    const track = (event: Parameters<typeof trackPaperworkVerification>[1], properties?: Record<string, unknown>) =>
        trackPaperworkVerification(tracking, event, properties)
    useEffect(() => {
        track(ANALYTICS_EVENTS.KYC_PV_VIEWED, {
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
        if (showIntro) track(ANALYTICS_EVENTS.KYC_PV_STEPS_VIEWED, { question_screens: questionIds.length })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showIntro])
    useEffect(() => {
        if (step === 'saved') track(ANALYTICS_EVENTS.KYC_PV_SAVED_VIEWED)
        if (step === 'review') track(ANALYTICS_EVENTS.KYC_PV_REVIEW_VIEWED, { status: status ?? null })
        if (step === 'verified') track(ANALYTICS_EVENTS.KYC_PV_VERIFIED_VIEWED)
        if (step === 'address-proof') track(ANALYTICS_EVENTS.KYC_PV_POA_VIEWED)
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
    if (showIntro) {
        screen = (
            <StepsScreen
                hasQuestions={questionIds.length > 0}
                questionsDone={allAnswered}
                onBack={exit}
                onContinue={() => {
                    track(ANALYTICS_EVENTS.KYC_PV_STEPS_CONTINUED, { next: step })
                    setIntro(false)
                }}
            />
        )
    } else if (step === 'saved') {
        screen = <SavedScreen onContinue={() => void stepper.goTo('id')} />
    } else if (current) {
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
        screen = (
            <IdentityDocumentScreen
                plan={plan}
                residence={questions.residence}
                citizenship={citizenshipOf(questions)}
                busy={identity.busy}
                error={idError}
                onBack={() => void stepper.back()}
                onContinue={(document) => void startIdentity(document)}
                onChangeResidence={() => {
                    track(ANALYTICS_EVENTS.KYC_PV_RESIDENCE_CHANGE_OPENED, { step: 'id' })
                    setResidenceMounted(true)
                    setResidenceOpen(true)
                }}
            />
        )
    } else if (step === 'review') {
        screen = (
            <ReviewScreen
                failed={failed}
                features={plan?.features}
                onHome={goHome}
                onRetry={
                    status === 'ACTION_REQUIRED'
                        ? () => {
                              track(ANALYTICS_EVENTS.KYC_PV_REVIEW_RETRY)
                              void startIdentity()
                          }
                        : undefined
                }
                busy={identity.busy}
                error={idError}
            />
        )
    } else if (step === 'verified') {
        screen = <VerifiedScreen features={plan?.features} onHome={goHome} />
    } else if (step === 'address-proof') {
        screen = (
            <ProofOfAddressStep
                residenceName={residenceName}
                onDone={(outcome) => {
                    track(
                        outcome === 'skipped'
                            ? ANALYTICS_EVENTS.KYC_PV_POA_SKIPPED
                            : ANALYTICS_EVENTS.KYC_PV_POA_UPLOADED
                    )
                    void stepper.goTo('verified')
                }}
                onUploadStarted={() => track(ANALYTICS_EVENTS.KYC_PV_POA_UPLOAD_STARTED)}
            />
        )
    }

    return (
        <PaperworkVerificationTrackingProvider value={tracking}>
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
                    track(ANALYTICS_EVENTS.KYC_PV_IDENTITY_CLOSED)
                    identity.close()
                }}
                onComplete={() => {
                    track(ANALYTICS_EVENTS.KYC_PV_IDENTITY_SUBMITTED)
                    identity.close()
                    setStatus('PENDING')
                    setSubmitted(true)
                    void stepper.goTo('review')
                }}
                onRefreshToken={identity.refreshToken}
            />
        </PaperworkVerificationTrackingProvider>
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
