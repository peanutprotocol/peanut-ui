'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
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
    PaperworkVerificationStep,
    PaperworkVerificationStepId,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import {
    PAPERWORK_VERIFICATION_FLOW,
    type KycDocumentPlan,
    type KycPlanNeed,
} from '@/app/actions/types/kyc-workflow.types'
import { localizedCountryName } from '@/utils/country-name.utils'
import { identityDocuments } from '@/utils/kyc-document-plan.utils'
import { IdentityDocumentScreen } from './components/IdentityDocumentScreen'
import { QuestionStepScreen, trackSaveOutcome } from './components/QuestionStepScreen'
import { LoadFailed, VerifyLoading } from './components/LoadScreens'
import { VerifySetupPrelude } from './components/VerifySetupPrelude'
import { restoreNativeStatusBar } from './useInsetColor'
import {
    ProofOfAddressScreen,
    ReviewScreen,
    SavedScreen,
    StepsScreen,
    VerifiedScreen,
} from './components/StatusScreens'
import {
    stepsLabel,
    trackPaperworkVerification,
    PaperworkVerificationTrackingProvider,
    type PaperworkVerificationTrackingContext,
} from './analytics'
import {
    PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
    PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY,
    PAPERWORK_VERIFICATION_STATUS_QUERY_KEY,
} from './usePaperworkVerificationStart'
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
import { saveSteps, type AnswerFormError, type SaveOutcome } from './useAnswerForm'

const STATUS_POLL_MS = 15_000
const SAVE_RETRY_DELAYS_MS = [1_000, 3_000]

type Loaded = {
    questions: PaperworkVerificationQuestions
    plan: KycDocumentPlan | null
    status: SumsubKycStatus | undefined
}

/** What Home loaded for this visit, when it is enough to open on. */
function cachedLoad(queryClient: QueryClient): Loaded | null {
    const plan = queryClient.getQueryData<KycDocumentPlan | null>(PAPERWORK_VERIFICATION_PLAN_QUERY_KEY)
    const questions = queryClient.getQueryData<PaperworkVerificationQuestions>(
        PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY
    )
    if (plan?.flow !== PAPERWORK_VERIFICATION_FLOW || plan.needs?.length || !questions?.available) return null
    const status = queryClient.getQueryData<SumsubKycStatus>(PAPERWORK_VERIFICATION_STATUS_QUERY_KEY)
    return { questions, plan, status }
}

/** The screens a load opens on: a fresh read that differs from the cached one reopens the flow. */
const shapeOf = ({ questions, plan, status }: Loaded) =>
    JSON.stringify([
        entryStep({ questions, plan, status }, false),
        questions.steps.map((s) => [s.id, s.answered]),
        status ?? null,
    ])

const RETRY: SaveOutcome = { ok: false, error: 'retry', formError: 'retry' }

async function saveWithRetries(steps: PaperworkVerificationStep[], values: PaperworkVerificationAnswers) {
    for (let attempt = 0; ; attempt++) {
        const outcome = await saveSteps(steps, values).catch(() => RETRY)
        if (outcome.ok || outcome.error !== 'retry' || attempt >= SAVE_RETRY_DELAYS_MS.length) return outcome
        await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_DELAYS_MS[attempt]))
    }
}

/**
 * /verify: the Smart Paperwork Verification identity check. Peanut asks the questions the
 * signup features need (each Continue writes them to Sumsub), then the
 * midpoint picks the ID, then Sumsub takes the photos and the selfie. The
 * server is the source of truth for every answer and for where to resume.
 */
export function PaperworkVerificationFlow() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [state, setState] = useState<
        | { kind: 'loading' }
        | { kind: 'failed' }
        | { kind: 'setup'; needs: KycPlanNeed[] }
        | ({ kind: 'ready'; fresh?: Loaded } & Loaded)
    >(() => {
        const cached = cachedLoad(queryClient)
        return cached ? { kind: 'ready', ...cached } : { kind: 'loading' }
    })
    const opened = useRef(state.kind === 'ready' ? shapeOf(state) : null)
    const exit = useSafeBack('/home')
    const [generation, setGeneration] = useState(0)
    // The steps overview opens a visit once; a reload mid-flow goes straight back to the open step.
    const introShown = useRef(false)
    // A load must not re-run because the router object changed identity.
    const routerRef = useRef(router)
    routerRef.current = router

    // `quiet` refreshes a cached open behind its screens instead of showing the loading one.
    const load = useCallback(async (quiet = false) => {
        if (!quiet) setState({ kind: 'loading' })
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
            const loaded = { questions, plan, status }
            if (quiet && shapeOf(loaded) === opened.current) {
                setState((current) => (current.kind === 'ready' ? { ...current, fresh: loaded } : current))
                return
            }
            setState({ kind: 'ready', ...loaded })
            setGeneration((g) => g + 1)
        } catch {
            // the cached screens stay; the next answer or ID step reads the server again
            if (quiet) return
            trackPaperworkVerification(
                { flow: 'paperwork_verification', residence: null },
                ANALYTICS_EVENTS.KYC_PV_LOAD_FAILED
            )
            setState({ kind: 'failed' })
        }
    }, [])

    useEffect(() => {
        void load(opened.current !== null)
        // Once per visit: a cached open refreshes quietly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
    // The signup prelude's wrapper paints the native status bar and leaves it painted.
    useEffect(() => restoreNativeStatusBar, [])

    if (state.kind === 'loading') return <VerifyLoading />
    if (state.kind === 'failed') return <LoadFailed onRetry={() => void load()} onHome={() => router.push('/home')} />
    if (state.kind === 'setup') return <VerifySetupPrelude needs={state.needs} onDone={load} onExit={exit} />
    return (
        <PaperworkVerificationSteps
            key={generation}
            initial={state}
            fresh={state.fresh}
            reload={load}
            introShown={introShown}
        />
    )
}

function PaperworkVerificationSteps({
    initial,
    fresh,
    reload,
    introShown,
}: {
    initial: Loaded
    /** the server's read behind a cached open, with the same screens */
    fresh?: Loaded
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
    const queryClient = useQueryClient()
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

    const stepRef = useRef(step)
    stepRef.current = step
    // Continue moves on at once; each screen's answers save behind the next one, in order.
    const saves = useRef<Promise<void>>(Promise.resolve())
    const submissions = useRef(0)
    const saveRefused = useRef(false)
    const settled = useRef<Promise<void>>(Promise.resolve())
    const rejections = useRef<Partial<Record<PaperworkVerificationStepId, number>>>({})
    const [returned, setReturned] = useState<{
        step: PaperworkVerificationStepId
        errors?: Record<string, string>
        formError?: AnswerFormError
    } | null>(null)
    const [savedBusy, setSavedBusy] = useState(false)

    const saveFailed = (shown: PaperworkVerificationStep[], outcome: SaveOutcome & { ok: false }) => {
        if (outcome.error && outcome.error !== 'retry') return onConflict(outcome.error)
        saveRefused.current = true
        const refused = outcome.rejected?.step ?? shown[0].id
        setQuestions((current) => ({
            ...current,
            steps: current.steps.map((s) => (s.id === refused ? { ...s, answered: false } : s)),
        }))
        setReturned({ step: refused, errors: outcome.rejected?.errors, formError: outcome.formError })
        void stepper.goTo(screenOf(refused))
    }

    const submitAnswers = (
        shown: PaperworkVerificationStep[],
        values: PaperworkVerificationAnswers,
        seconds: number
    ) => {
        const ids = shown.map((s) => s.id)
        const updated = ids.reduce((current, id) => markSaved(current, id, values), questions)
        setQuestions(updated)
        setReturned(null)
        saveRefused.current = false
        const last = ids[ids.length - 1]
        const following =
            updated.steps.slice(updated.steps.findIndex((s) => s.id === last) + 1).find((s) => !s.answered)?.id ??
            updated.steps.find((s) => !s.answered)?.id
        void stepper.goTo(following ? screenOf(following) : 'saved')

        const submission = ++submissions.current
        const stepTracking = { ...tracking, step: ids[0] }
        saves.current = saves.current.then(async () => {
            const outcome = await saveWithRetries(shown, values)
            trackSaveOutcome(
                (event, properties) =>
                    trackPaperworkVerification(stepTracking, event, { steps: stepsLabel(shown), ...properties }),
                outcome,
                { seconds, rejectedBefore: rejections.current[ids[0]] ?? 0 }
            )
            if (outcome.ok) return
            if (outcome.rejected) rejections.current[ids[0]] = (rejections.current[ids[0]] ?? 0) + 1
            saveFailed(shown, outcome)
        })
        if (following) return
        // The last answer reserves the attempt: read it and the ID's documents back before the midpoint needs them.
        settled.current = saves.current.then(async () => {
            if (submission !== submissions.current || saveRefused.current) return
            const [freshQuestions, freshPlan] = await Promise.all([
                getKycQuestions().catch(() => null),
                findKycDocumentPlan('verify').catch(() => null),
            ])
            if (submission !== submissions.current || saveRefused.current) return
            if (freshPlan) setPlan(freshPlan)
            if (!freshQuestions) return
            setQuestions(freshQuestions)
            const open = resumeStep(freshQuestions)
            if (open) void stepper.goTo(screenOf(open))
        })
    }

    const continueFromSaved = async () => {
        setSavedBusy(true)
        await settled.current
        setSavedBusy(false)
        if (stepRef.current === 'saved' && !saveRefused.current) void stepper.goTo('id')
    }

    // A cached open takes the server's read in as long as nothing was answered on top of it.
    useEffect(() => {
        if (!fresh || submissions.current) return
        setQuestions(fresh.questions)
        setPlan(fresh.plan)
        setStatus(fresh.status)
    }, [fresh])
    // The next visit opens on what this one ends with.
    useEffect(() => {
        queryClient.setQueryData(PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY, questions)
    }, [queryClient, questions])
    useEffect(() => {
        queryClient.setQueryData(PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, plan)
    }, [queryClient, plan])
    useEffect(() => {
        if (status) queryClient.setQueryData(PAPERWORK_VERIFICATION_STATUS_QUERY_KEY, status)
    }, [queryClient, status])

    // A plan read before the attempt existed can lack the ID's documents: read it once more on the ID screen.
    const documentsReread = useRef(false)
    const [documentsLoading, setDocumentsLoading] = useState(false)
    const needsDocuments = step === 'id' && !identityDocuments(plan?.routes[0]).length
    useEffect(() => {
        if (!needsDocuments || documentsReread.current) return
        documentsReread.current = true
        setDocumentsLoading(true)
        void findKycDocumentPlan('verify')
            .catch(() => null)
            .then((current) => {
                if (current) setPlan(current)
                setDocumentsLoading(false)
            })
    }, [needsDocuments])

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
        screen = <SavedScreen busy={savedBusy} onContinue={() => void continueFromSaved()} />
    } else if (current) {
        const shown = phoneJoined && current.id === 'address' && phone ? [current, phone] : [current]
        screen = (
            <QuestionStepScreen
                key={current.id}
                steps={shown}
                residence={questions.residence}
                progress={stepProgress(questionIds, current.id)}
                onBack={() => void stepper.back()}
                onSubmitted={(values, seconds) => submitAnswers(shown, values, seconds)}
                returned={returned && shown.some((s) => s.id === returned.step) ? returned : undefined}
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
                documentsLoading={documentsLoading}
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
