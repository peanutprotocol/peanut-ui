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
import { useModalsContextOptional } from '@/context/ModalsContext'
import { RETRY_ACTIONS } from '@/constants/sumsub-reject-actions.consts'
import { isTerminalRejection } from '@/constants/sumsub-reject-labels.consts'
import type { IdentityVerification } from '@/types/capabilities'
import { identityRejection, rejectionSupportMessage, type IdentityRejection } from '@/utils/identity-rejection.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { verifiedFollowUps } from './followUps'
import { useFlowStepper } from '@/hooks/useFlowStepper'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSessionFence } from '@/hooks/useSessionFence'
import { captureSessionFence } from '@/utils/session-fence'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
    getIdentityDocumentMismatch,
    getKycQuestions,
    savePaperworkVerificationFeatures,
    skipProofOfAddress,
} from '@/app/actions/kyc-paperwork-verification'
import { updateUserById } from '@/app/actions/users'
import { ResidenceCompare } from '@/components/Setup/components/ResidenceCompare'
import { storeDeclaredResidence } from '@/utils/declared-residence.storage'
import { findKycDocumentPlan, getKycDocumentStatus, refreshKycIdentityStatus } from '@/app/actions/kyc-workflow'
import type { FeatureReverificationEntry } from '@/app/actions/types/kyc-reverification.types'
import { safeReverificationReturnTo } from '@/utils/kyc-reverification'
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
import { pendingResidenceCountry } from '@/utils/residence-profile'
import { identityDocuments } from '@/utils/kyc-document-plan.utils'
import { IdentityDocumentScreen } from './components/IdentityDocumentScreen'
import { QuestionStepScreen, trackSaveOutcome } from './components/QuestionStepScreen'
import { LoadFailed, VerifyLoading } from './components/LoadScreens'
import { ResidenceNotSupportedScreen } from './components/ResidenceNotSupportedScreen'
import { VerifySetupPrelude } from './components/VerifySetupPrelude'
import { restoreNativeStatusBar } from './useInsetColor'
import { ClosedFeaturesNotice, ProofOfAddressScreen, ReviewScreen } from './components/StatusScreens'
import { StepsScreen } from './components/StepsScreen'
import { VerifyStartIntro } from '@/components/Setup/redesign/VerifyStart/VerifyStartIntro'
import { currentVerifySource } from './verifySource'
import { BankRefusalNotice } from './components/BankRefusalNotice'
import { supportRefusal } from '@/features/kyc-features/report'
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
    APPROVED_STATUSES,
    DOCUMENT_KEYS,
    entryStep,
    featureOpenAfterApproval,
    FAILED_STATUSES,
    IN_REVIEW_STATUSES,
    RETRYABLE_STATUSES,
    markSaved,
    nationalityOf,
    composeScreens,
    PAYMENT_METHODS_HREF,
    phoneJoinsAddress,
    questionPages,
    RESIDENCE_CHANGE_HREF,
    resumeStep,
    screenOfStep,
    stepProgress,
    stepUnchanged,
    type VerifyStep,
} from './paperworkVerification.utils'
import { saveSteps, type AnswerFormError, type SaveOutcome } from './useAnswerForm'
import { paperworkVerificationFeaturePath, RESIDENCE_NOT_SUPPORTED_PATH } from './paperworkVerificationEntry'
import { useVerificationOpening } from './useVerificationOpening'

const STATUS_POLL_MS = 15_000
const REFRESH_EVERY_POLLS = 4
const SAVE_RETRY_DELAYS_MS = [1_000, 3_000]

type Candidate = FeatureReverificationEntry & { attemptId: string }
type CandidateProps = { candidate?: Candidate; startedStatus?: SumsubKycStatus; returnTo?: string | null }

async function readCandidatePlan(candidate: Candidate) {
    const plan = await findKycDocumentPlan('verify', undefined, undefined, candidate.attemptId)
    if (plan?.unavailableReason === 'residence_not_supported') return plan
    const entry = plan?.entry
    if (
        entry?.attemptId !== candidate.attemptId ||
        entry.feature !== candidate.feature ||
        entry.targetProvider !== candidate.targetProvider ||
        entry.prepared === false
    )
        return null
    return plan ? { ...plan, proofOfAddress: undefined } : null
}

const normalizeCandidateStatus = (status: SumsubKycStatus): SumsubKycStatus =>
    status === 'REVERIFYING' ? 'IN_REVIEW' : status

const candidateSubmissionKey = (userId: string | undefined, attemptId: string) =>
    `kyc:feature-reverification:submitted:${JSON.stringify([userId, attemptId])}`

function candidateSubmissionPending(key: string) {
    try {
        return sessionStorage.getItem(key) === '1'
    } catch {
        return false
    }
}

// sign-up and the legacy start push /verify again, which remounts the flow and empties its refs, so the
// "start screen seen" mark lives in session storage, per account (TASK-25326)
const introSeenKey = (userId: string) => `peanut:verify-intro-seen:${userId}`

function introSeen(userId: string | undefined) {
    if (!userId) return false
    try {
        return sessionStorage.getItem(introSeenKey(userId)) === '1'
    } catch {
        return false
    }
}

function markIntroSeen(userId: string | undefined) {
    if (!userId) return
    try {
        sessionStorage.setItem(introSeenKey(userId), '1')
    } catch {
        // storage unavailable: the start screen may show again on the next mount
    }
}

type Loaded = {
    questions: PaperworkVerificationQuestions
    plan: KycDocumentPlan | null
    status: SumsubKycStatus | undefined
}

/** What Home loaded for this visit, when it is enough to open on. */
function cachedLoad(queryClient: QueryClient, userId?: string): Loaded | null {
    if (!userId) return null
    const plan = queryClient.getQueryData<KycDocumentPlan | null>([...PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, userId])
    const questions = queryClient.getQueryData<PaperworkVerificationQuestions>([
        ...PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY,
        userId,
    ])
    if (
        plan?.flow !== PAPERWORK_VERIFICATION_FLOW ||
        plan.unavailableReason ||
        plan.needs?.length ||
        !questions?.available
    )
        return null
    const status = queryClient.getQueryData<SumsubKycStatus>([...PAPERWORK_VERIFICATION_STATUS_QUERY_KEY, userId])
    return { questions, plan, status }
}

const readQuestions = (router: { replace: (href: string) => void }, current: () => boolean) =>
    getKycQuestions().catch((error: { status?: number; code?: string } | null) => {
        if (current()) {
            if (error?.status === 409 && error.code === 'existing_verification') router.replace('/home')
            if (error?.status === 403 && error.code === 'residence_not_supported')
                router.replace(RESIDENCE_NOT_SUPPORTED_PATH)
        }
        return null
    })

const shapeOf = ({ questions, plan, status }: Loaded) =>
    JSON.stringify([
        entryStep({ questions, plan, status }, false),
        questions.steps.map((s) => [s.id, s.answered]),
        status ?? null,
    ])

const RETRY: SaveOutcome = { ok: false, error: 'retry', formError: 'retry' }

/** A decision on the identity: no attempt can pass it, so /verify ends on why, whatever flow the server keeps. */
const decidedRejection = (identity: IdentityVerification | undefined, status: SumsubKycStatus | undefined) => {
    if (status === 'REJECTED') return true
    if (!identity || identity.reason?.code === 'identity_region_restricted') return false
    if (identity.status === 'failed' && identity.canRetry !== true) return true
    return (
        identity.status === 'action_required' &&
        isTerminalRejection({ rejectType: identity.rejectType, rejectLabels: identity.rejectLabels })
    )
}

/** Support and, for a duplicate, the other account: the ways on from a rejection. */
function useRejectionExits(rejection: IdentityRejection) {
    const tRoot = useTranslations()
    const modals = useModalsContextOptional()
    const { user, logoutUser } = useAuth()
    const support = rejection.support
    const reason = user?.identityVerification?.reason
    return {
        onContactSupport:
            support && modals
                ? () =>
                      modals.openSupportWithMessage(
                          rejectionSupportMessage(
                              support,
                              tRoot(support.messageKey as never),
                              reason,
                              user?.user?.userId
                          )
                      )
                : undefined,
        onLogIn: rejection.action === 'other_account' && logoutUser ? () => void logoutUser() : undefined,
    }
}

/** A rejected identity the server no longer keeps on this flow: its reason and the way on. */
function DecidedRejection({ status, onHome }: { status?: SumsubKycStatus; onHome: () => void }) {
    const { user } = useAuth()
    const identity = user?.identityVerification
    const rejection = useMemo(
        () => identityRejection({ rejectLabels: identity?.rejectLabels, reason: identity?.reason, retryable: false }),
        [identity?.rejectLabels, identity?.reason]
    )
    const exits = useRejectionExits(rejection)
    useEffect(() => {
        trackPaperworkVerification(
            { flow: 'paperwork_verification', residence: null },
            ANALYTICS_EVENTS.KYC_PV_REVIEW_VIEWED,
            { status: status ?? null, action: rejection.action }
        )
        // Once per visit.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const policyHold =
        identity?.reason?.code === 'document_policy_hold' ||
        identity?.rejectLabels?.includes('DOCUMENT_POLICY_HOLD') === true
    return <ReviewScreen rejection={rejection} onHome={onHome} policyHold={policyHold} {...exits} />
}

/** A finally rejected identity's own screen, for entry points outside /verify (the card tab). */
export function IdentityRejectedScreen({ onHome }: { onHome: () => void }) {
    return (
        <PaperworkVerificationTrackingProvider value={{ flow: 'paperwork_verification', residence: null }}>
            <DecidedRejection onHome={onHome} />
        </PaperworkVerificationTrackingProvider>
    )
}

/** Whether the profile alone says no attempt can pass: failed, and the API offers no retry. */
export const isDecidedRejection = (identity: IdentityVerification | undefined) => decidedRejection(identity, undefined)

/** A NOT_STARTED identity may have been submitted before Sumsub's webhook arrived: the server reads Sumsub then. */
async function readIdentityStatus(): Promise<SumsubKycStatus | undefined> {
    const stored = await getKycDocumentStatus().catch(() => undefined)
    if (stored && stored !== 'NOT_STARTED') return stored
    return (await refreshKycIdentityStatus()) ?? stored
}

async function saveWithRetries(
    steps: PaperworkVerificationStep[],
    values: PaperworkVerificationAnswers,
    userId: string | undefined,
    current: () => boolean,
    candidate?: Candidate
): Promise<SaveOutcome> {
    for (let attempt = 0; ; attempt++) {
        if (!current()) return { ok: false, error: 'session_changed', formError: 'unavailable' } as const
        const outcome = await saveSteps(steps, values, candidate?.feature, userId, current, candidate?.attemptId).catch(
            () => RETRY
        )
        if (!current()) return { ok: false, error: 'session_changed', formError: 'unavailable' } as const
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
export function PaperworkVerificationFlow(props: CandidateProps = {}) {
    const { user } = useAuth()
    const userId = user?.user.userId
    // An account change remounts the private state and cancels its continuations.
    return (
        <PaperworkVerificationAccount
            key={JSON.stringify([
                userId,
                props.candidate?.attemptId,
                props.candidate?.feature,
                props.candidate?.targetProvider,
            ])}
            userId={userId}
            {...props}
        />
    )
}

function PaperworkVerificationAccount({
    userId,
    candidate,
    startedStatus,
    returnTo,
}: CandidateProps & { userId?: string }) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const identityRef = useRef(user?.identityVerification)
    identityRef.current = user?.identityVerification
    const [state, setState] = useState<
        | { kind: 'loading' }
        | { kind: 'failed' }
        | { kind: 'residence-not-supported' }
        | { kind: 'rejected'; status?: SumsubKycStatus }
        | { kind: 'setup'; needs: KycPlanNeed[] }
        | { kind: 'candidate-terminal'; status: 'APPROVED' | 'REJECTED' }
        | ({ kind: 'ready'; fresh?: Loaded } & Loaded)
    >(() => {
        const cached = candidate ? null : cachedLoad(queryClient, userId)
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
    const loadGeneration = useRef(0)
    useEffect(
        () => () => {
            loadGeneration.current += 1
        },
        []
    )

    const owner = useRef({ candidate, startedStatus, userId })
    owner.current = { candidate, startedStatus, userId }

    // `quiet` refreshes a cached open behind its screens instead of showing the loading one.
    const load = useCallback(async (quiet = false) => {
        const generation = ++loadGeneration.current
        const { candidate, startedStatus, userId } = owner.current
        const fence = candidate ? captureSessionFence(userId) : null
        const current = () => generation === loadGeneration.current && (fence?.current() ?? true)
        if (!quiet) setState({ kind: 'loading' })
        try {
            if (candidate) {
                if (fence?.ready) await fence.ready
                if (!current()) return
                const status = (await getKycDocumentStatus(undefined, candidate.attemptId)) ?? startedStatus
                if (!current()) return
                if (status === 'APPROVED' || status === 'REJECTED') {
                    setState({ kind: 'candidate-terminal', status })
                    return
                }
                const [questionsRead, planRead] = await Promise.allSettled([
                    getKycQuestions(candidate.feature, candidate.attemptId, current),
                    readCandidatePlan(candidate),
                ])
                if (!current()) return
                if (planRead.status === 'rejected') throw planRead.reason
                const candidatePlan = planRead.value
                if (candidatePlan?.unavailableReason === 'residence_not_supported') {
                    setState({ kind: 'residence-not-supported' })
                    return
                }
                if (questionsRead.status === 'rejected') throw questionsRead.reason
                const questions = questionsRead.value
                if (!questions.available || questions.attemptId !== candidate.attemptId || !candidatePlan || !status)
                    throw new Error('Candidate unavailable')
                setState({
                    kind: 'ready',
                    questions,
                    plan: candidatePlan,
                    status:
                        status === 'NOT_STARTED' &&
                        candidateSubmissionPending(candidateSubmissionKey(userId, candidate.attemptId))
                            ? 'PENDING'
                            : normalizeCandidateStatus(status),
                })
                setGeneration((generation) => generation + 1)
                return
            }
            const plan = await findKycDocumentPlan('verify')
            if (!current()) return
            if (plan?.unavailableReason === 'residence_not_supported') {
                setState({ kind: 'residence-not-supported' })
                return
            }
            if (!plan || plan.flow === undefined) throw new Error('KYC plan unavailable')
            const [questionsRead, statusRead] = await Promise.allSettled([getKycQuestions(), readIdentityStatus()])
            if (!current()) return
            const questions = questionsRead.status === 'fulfilled' ? questionsRead.value : null
            const status = statusRead.status === 'fulfilled' ? statusRead.value : undefined
            const onFlow = questions?.available && plan.flow === PAPERWORK_VERIFICATION_FLOW
            if (!onFlow && decidedRejection(identityRef.current, status)) {
                setState({ kind: 'rejected', status })
                return
            }
            if (
                questionsRead.status === 'rejected' &&
                questionsRead.reason?.status === 409 &&
                questionsRead.reason?.code === 'existing_verification'
            ) {
                routerRef.current.replace('/home')
                return
            }
            if (statusRead.status === 'rejected') throw statusRead.reason
            if (plan.flow === PAPERWORK_VERIFICATION_FLOW && plan.needs?.length) {
                setState({ kind: 'setup', needs: plan.needs })
                return
            }
            if (plan.flow === null) {
                routerRef.current.replace('/home')
                return
            }
            if (questionsRead.status === 'rejected') throw questionsRead.reason
            if (!questions?.available) throw new Error('KYC questions unavailable')
            const addLater = featureOpenAfterApproval(questions, status)
            if (addLater) {
                routerRef.current.replace(paperworkVerificationFeaturePath(addLater))
                return
            }
            const loaded = { questions, plan, status }
            if (quiet && shapeOf(loaded) === opened.current) {
                setState((current) => (current.kind === 'ready' ? { ...current, fresh: loaded } : current))
                return
            }
            setState({ kind: 'ready', ...loaded })
            setGeneration((g) => g + 1)
        } catch (error) {
            if (!current()) return
            const failure = error as { code?: string; status?: number } | null
            if (failure?.status === 403 && failure.code === 'residence_not_supported') {
                setState({ kind: 'residence-not-supported' })
                return
            }
            if (decidedRejection(identityRef.current, undefined)) {
                setState({ kind: 'rejected' })
                return
            }
            // the cached screens stay; the next answer or ID step reads the server again
            if (quiet) return
            trackPaperworkVerification(
                {
                    flow: 'paperwork_verification',
                    residence: null,
                    ...(candidate && { purpose: 'reverify_for_feature' as const, feature: candidate.feature }),
                },
                ANALYTICS_EVENTS.KYC_PV_LOAD_FAILED
            )
            setState({ kind: 'failed' })
        }
    }, [])

    useEffect(() => {
        void load(opened.current !== null)
        // Once per visit: a cached open refreshes quietly.
    }, [load])
    // The signup prelude's wrapper paints the native status bar and leaves it painted.
    useEffect(() => restoreNativeStatusBar, [])

    if (state.kind === 'loading' || state.kind === 'failed')
        return (
            <PaperworkVerificationTrackingProvider
                value={{
                    flow: 'paperwork_verification',
                    residence: null,
                    ...(candidate && { purpose: 'reverify_for_feature' as const, feature: candidate.feature }),
                }}
            >
                {state.kind === 'loading' ? (
                    <VerifyLoading onBack={exit} />
                ) : (
                    <LoadFailed onRetry={() => void load()} onHome={() => router.push('/home')} />
                )}
            </PaperworkVerificationTrackingProvider>
        )
    if (state.kind === 'residence-not-supported') return <ResidenceNotSupportedScreen onBack={exit} />
    if (state.kind === 'rejected')
        return (
            <PaperworkVerificationTrackingProvider value={{ flow: 'paperwork_verification', residence: null }}>
                <DecidedRejection status={state.status} onHome={() => router.replace('/home')} />
            </PaperworkVerificationTrackingProvider>
        )
    if (state.kind === 'setup') return <VerifySetupPrelude needs={state.needs} onDone={load} onExit={exit} />
    if (state.kind === 'candidate-terminal' && candidate)
        return <CandidateTerminal candidate={candidate} status={state.status} returnTo={returnTo} />
    if (state.kind !== 'ready') return null
    return (
        <PaperworkVerificationSteps
            key={generation}
            initial={state}
            fresh={state.fresh}
            reload={load}
            introShown={introShown}
            candidate={candidate}
            returnTo={returnTo}
        />
    )
}

function CandidateTerminal({
    candidate,
    status,
    returnTo,
}: {
    candidate: Candidate
    status: 'APPROVED' | 'REJECTED'
    returnTo?: string | null
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const router = useRouter()
    const goHome = () => router.replace('/home')
    const approved = status === 'APPROVED'
    const complete = useCandidateReturn(returnTo)
    const tracking = {
        flow: 'paperwork_verification',
        purpose: 'reverify_for_feature',
        feature: candidate.feature,
        residence: null,
    } as const
    useEffect(() => {
        trackPaperworkVerification(
            tracking,
            approved ? ANALYTICS_EVENTS.KYC_PV_VERIFIED_VIEWED : ANALYTICS_EVENTS.KYC_PV_REVIEW_VIEWED
        )
        // This component is mounted for the candidate's terminal result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return (
        <PaperworkVerificationTrackingProvider value={tracking}>
            {approved ? (
                <StepsScreen phase="verified" cta={t('continue')} onBack={goHome} onContinue={complete} />
            ) : (
                <ReviewScreen
                    rejection={identityRejection({ retryable: false })}
                    onHome={goHome}
                    copy={{
                        title: t('reverify.refusalTitle'),
                        description: t(
                            candidate.feature === 'card'
                                ? 'reverify.refusalCard'
                                : candidate.feature === 'bank'
                                  ? 'reverify.refusalBank'
                                  : 'reverify.refusalLocal'
                        ),
                    }}
                />
            )}
        </PaperworkVerificationTrackingProvider>
    )
}

/**
 * Back to a safe returnTo once the user is read again, so that place sees the new status. Only while the
 * same session holds: a logout or account switch during the read stops it. `waitMs` caps a slow read;
 * `orElse` runs instead when there is no safe returnTo (default: Home after the read, as a candidate ends).
 */
function useCandidateReturn(
    returnTo?: string | null,
    { waitMs, orElse }: { waitMs?: number; orElse?: () => void } = {}
) {
    const router = useRouter()
    const { fetchUser } = useAuth()
    const captureSession = useSessionFence()
    const returning = useRef(false)
    const target = safeReverificationReturnTo(returnTo)
    return async () => {
        if (!target && orElse) return orElse()
        if (returning.current) return
        const session = captureSession()
        returning.current = true
        const read = Promise.resolve(fetchUser()).catch(() => {})
        await (waitMs ? Promise.race([read, new Promise((resolve) => setTimeout(resolve, waitMs))]) : read)
        if (session.current()) router.replace(target ?? '/home')
    }
}

function PaperworkVerificationSteps({
    initial,
    fresh,
    reload,
    introShown,
    candidate,
    returnTo,
}: CandidateProps & {
    initial: Loaded
    /** the server's read behind a cached open, with the same screens */
    fresh?: Loaded
    reload: () => Promise<void>
    introShown: React.MutableRefObject<boolean>
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const tDocuments = useTranslations('kyc.documents')
    const locale = useLocale()
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const completeCandidate = useCandidateReturn(returnTo)
    const modals = useModalsContextOptional()
    // What a feature still waits on once the identity is verified: steps of the verified timeline.
    const tRoot = useTranslations()
    const { nextActions, capabilities } = useCapabilities()
    const followUps = useMemo(
        () => verifiedFollowUps(nextActions, capabilities.features),
        [nextActions, capabilities.features]
    )
    const bankRefusal = supportRefusal(capabilities.features?.bank, nextActions)
    // The picked document's name for Sumsub's ID step; a retry without a pick keeps the last one.
    const [identityStepTitle, setIdentityStepTitle] = useState<string>()
    const exit = useSafeBack('/home')
    // Remind me later goes back where the person came from; from sign-up always to Home, never back into or before it
    const remindLater = () => (currentVerifySource() === 'signup' ? router.replace('/home') : exit())
    const [questions, setQuestions] = useState(initial.questions)
    const [plan, setPlan] = useState(initial.plan)
    const [status, setStatusState] = useState(initial.status)
    const latestStatus = useRef(status)
    const activeSdk = useRef<ReturnType<typeof usePaperworkVerificationIdentity>['session']>(null)
    const approvedSdk = useRef<ReturnType<typeof usePaperworkVerificationIdentity>['session']>(null)
    const setStatus = useCallback(
        (next: Loaded['status']) => {
            if (candidate && (latestStatus.current === 'APPROVED' || latestStatus.current === 'REJECTED')) return
            latestStatus.current = next
            if (next === 'APPROVED') approvedSdk.current = activeSdk.current
            setStatusState(next)
        },
        [candidate]
    )
    const [queryStep] = useQueryState('step')
    const stepParam = candidate ? null : queryStep
    const [returnToFeature] = useQueryState('returnToFeature')
    const linkedQuestion = useRef(stepParam)
    const enterLastPage = useRef<PaperworkVerificationStepId | undefined>(undefined)
    // A replacement hands off before its submission webhook necessarily arrives.
    const [submitted, setSubmitted] = useState(candidate ? initial.status === 'PENDING' : stepParam === 'review')
    const [idError, setIdError] = useState<string | null>(null)
    // Sumsub recognised the uploaded ID as another country's: which country the profile belongs to.
    const [documentMismatch, setDocumentMismatch] = useState<{ declared: string; document: string } | null>(null)
    const [mismatchBusy, setMismatchBusy] = useState(false)
    const [documentRequired, setDocumentRequired] = useState(false)
    const identity = usePaperworkVerificationIdentity({
        onExistingVerification: () => (candidate ? void reload() : router.replace('/home')),
        onResidenceNotSupported: () => router.replace(RESIDENCE_NOT_SUPPORTED_PATH),
        candidateAttemptId: candidate?.attemptId,
    })
    const closeIdentity = identity.close
    if (identity.session) activeSdk.current = identity.session
    const queryClient = useQueryClient()
    // Decided once per load, so Back shows the same screens the user came through.
    const [phoneJoined] = useState(() => phoneJoinsAddress(initial.questions))
    const screens = useMemo(() => composeScreens(questions, phoneJoined), [questions, phoneJoined])
    const screenOf = (id: VerifyStep): VerifyStep => screenOfStep(screens, id)

    const questionIds = useMemo(() => screens.map((ids) => ids[0]), [screens])
    const pageCounts = useMemo(
        () =>
            screens.map((ids) => {
                const fields = questions.steps.filter((step) => ids.includes(step.id)).flatMap((step) => step.fields)
                return questionPages(fields).length
            }),
        [screens, questions.steps]
    )
    const progressTotal = pageCounts.reduce((total, count) => total + count, 2)
    const steps = useMemo<VerifyStep[]>(
        () => [...questionIds, 'id', 'review', 'verified', 'address-proof'],
        [questionIds]
    )
    const allAnswered = questions.steps.every((s) => s.answered)
    const approved = !!status && APPROVED_STATUSES.has(status)
    const failed = !!status && FAILED_STATUSES.has(status)
    const policyHold =
        !candidate &&
        failed &&
        (user?.identityVerification?.reason?.code === 'document_policy_hold' ||
            user?.identityVerification?.rejectLabels?.includes('DOCUMENT_POLICY_HOLD') === true)
    const identityVerification = candidate ? undefined : user?.identityVerification
    const retryable =
        !!status &&
        (candidate
            ? status === 'ACTION_REQUIRED'
            : RETRYABLE_STATUSES.has(status) && identityVerification?.rejectType !== 'FINAL')
    const rejection = useMemo(
        () =>
            identityRejection({
                rejectLabels: identityVerification?.rejectLabels,
                reason: identityVerification?.reason,
                retryable,
            }),
        [identityVerification?.rejectLabels, identityVerification?.reason, retryable]
    )
    const rejectionExits = useRejectionExits(rejection)
    const fetchUserRef = useRef(fetchUser)
    fetchUserRef.current = fetchUser
    useEffect(() => {
        if (!candidate && failed) void Promise.resolve(fetchUserRef.current()).catch(() => {})
    }, [candidate, failed])
    const reviewing = submitted || (!!status && IN_REVIEW_STATUSES.has(status))
    const asking = !approved && !reviewing && !failed
    useVerificationOpening(asking, questions.entryScope)
    const entry = screenOf(entryStep({ questions, plan, status }, submitted))

    // A visit that still has questions or the ID ahead opens on Verify start, the one verify intro, in front
    // of the open step; a deep link to a step skips it.
    const [intro, setIntro] = useState(
        () => !candidate && asking && !introShown.current && !introSeen(user?.user.userId) && !stepParam
    )
    const showIntro = intro && asking
    // While asking, the clean URL keeps meaning the step this visit opened on, so moving on to
    // a step that has since become the entry (the ID, once every answer is in) still writes it.
    // A deep link to a step that shares a screen opens that screen.
    const [openedOn] = useState(() => {
        const linked = stepParam ? screenOf(stepParam as VerifyStep) : null
        return linked && linked !== stepParam ? linked : entry
    })
    const stepper = useFlowStepper<VerifyStep>({
        steps,
        defaultStep: asking ? openedOn : entry,
        guards: {
            ...Object.fromEntries(questionIds.map((id) => [id, { ok: asking }])),
            id: { ok: asking && (allAnswered || documentRequired) },
            review: { ok: reviewing || failed },
            verified: { ok: approved },
            'address-proof': { ok: approved && plan?.proofOfAddress === 'suggested' },
        },
        // Back from the first screen returns to Verify start, when this visit showed it.
        onExit: () => (asking && introShown.current ? setIntro(true) : exit()),
    })
    const step = stepper.step
    const goToStep = stepper.goTo
    useEffect(() => {
        if (!showIntro) return
        introShown.current = true
        markIntroSeen(user?.user.userId)
    }, [showIntro, introShown, user?.user.userId])

    const stepRef = useRef(step)
    stepRef.current = step
    const reviewingAnswers = useRef(false)
    const backRevision = useRef(0)
    // Screens save in order. Address and CUIT wait in place so a field refusal stays with its inputs.
    const saves = useRef<Promise<void>>(Promise.resolve())
    const captureSession = useSessionFence()
    const queueGeneration = useRef(0)
    useEffect(
        () => () => {
            queueGeneration.current += 1
        },
        []
    )
    const submissions = useRef(0)
    const saveRefused = useRef(false)
    const settled = useRef<Promise<void>>(Promise.resolve())
    const rejections = useRef<Partial<Record<PaperworkVerificationStepId, number>>>({})
    const [returned, setReturned] = useState<{
        step: PaperworkVerificationStepId
        errors?: Record<string, string>
        formError?: AnswerFormError
        message?: string
        focus?: boolean
    } | null>(null)
    // the ID screen's start waits for the last answer's checkpoint
    const [settling, setSettling] = useState(false)
    // the last answer's save and fresh read are on their way: the ID type picker offers no choice yet
    const [checkpointPending, setCheckpointPending] = useState(false)

    const backThroughQuestions = () => {
        backRevision.current += 1
        reviewingAnswers.current = !stepper.isFirst
        linkedQuestion.current = null
        enterLastPage.current =
            step === 'id' ? questionIds.at(-1) : questionIds[questionIds.findIndex((id) => id === step) - 1]
        setSettling(false)
        void stepper.back()
    }

    const saveFailed = (sent: PaperworkVerificationStep[], outcome: SaveOutcome & { ok: false }, navigate: boolean) => {
        saveRefused.current = true
        const refused = outcome.step ?? outcome.rejected?.step ?? sent[0].id
        // Saves stop at the refused step, so it and every step after it are still unsaved.
        const from = Math.max(
            0,
            sent.findIndex((s) => s.id === refused)
        )
        const unsaved = new Set(sent.slice(from).map((s) => s.id))
        setQuestions((current) => ({
            ...current,
            steps: current.steps.map((s) => (unsaved.has(s.id) ? { ...s, answered: false } : s)),
        }))
        setReturned({
            step: refused,
            errors: outcome.rejected?.errors,
            formError: outcome.formError,
            message: outcome.message,
            focus: navigate,
        })
        if (outcome.error && outcome.error !== 'retry' && onConflict(outcome.error, outcome.message)) return
        if (navigate) void stepper.goTo(screenOf(refused))
    }

    const submitAnswers = async (
        shown: PaperworkVerificationStep[],
        values: PaperworkVerificationAnswers,
        seconds: number
    ) => {
        const back = backRevision.current
        const generation = queueGeneration.current
        const session = captureSession()
        if (session.ready) await session.ready
        if (generation !== queueGeneration.current || back !== backRevision.current || stepRef.current !== shown[0].id)
            return
        if (!session.current() || (session.userId && session.userId !== user?.user.userId)) {
            queueGeneration.current += 1
            router.replace('/home')
            return
        }
        const current = () => generation === queueGeneration.current && session.current()
        const ids = shown.map((s) => s.id)
        // A shared screen also shows steps answered before; only new or edited answers are saved.
        const changed = shown.filter((s) => !stepUnchanged(s, values))
        const waitForSave =
            !!candidate || changed.some((s) => s.id === 'address' || s.fields.some((field) => field.format === 'cuit'))
        const stepTracking = { ...tracking, step: ids[0] }
        const persist = async () => {
            if (!current()) return false
            const outcome = await saveWithRetries(changed, values, user?.user.userId, current, candidate)
            if (!current()) return false
            trackSaveOutcome(
                (event, properties) =>
                    trackPaperworkVerification(stepTracking, event, { steps: stepsLabel(changed), ...properties }),
                outcome,
                { seconds, rejectedBefore: rejections.current[ids[0]] ?? 0 }
            )
            if (outcome.ok) return true
            // A protocol conflict invalidates the remaining queued batches.
            if (outcome.error && outcome.error !== 'retry') queueGeneration.current += 1
            if (outcome.rejected) rejections.current[ids[0]] = (rejections.current[ids[0]] ?? 0) + 1
            if (waitForSave) {
                // A shared address/phone page may have saved one step before the other was refused.
                const refusedAt = changed.findIndex((s) => s.id === (outcome.step ?? outcome.rejected?.step))
                if (refusedAt > 0)
                    setQuestions((currentQuestions) =>
                        changed
                            .slice(0, refusedAt)
                            .reduce((state, s) => markSaved(state, s.id, values), currentQuestions)
                    )
            }
            saveFailed(changed, outcome, back === backRevision.current)
            return false
        }
        if (waitForSave) {
            const saved = saves.current.then(persist)
            saves.current = saved.then(() => undefined)
            if (!(await saved) || !current() || back !== backRevision.current || stepRef.current !== shown[0].id) return
        }
        const updated = ids.reduce((current, id) => markSaved(current, id, values), questions)
        setQuestions(updated)
        setReturned((current) => (current && ids.includes(current.step) ? null : current))
        saveRefused.current = false
        const open = (screen: PaperworkVerificationStepId[]) =>
            screen.some((id) => updated.steps.find((s) => s.id === id)?.answered === false)
        const at = screens.findIndex((screen) => screen.includes(ids[0]))
        // After Back or a link to saved answers, review the adjacent screens in order.
        const reviewing = reviewingAnswers.current || shown.every((s) => s.answered)
        const next = reviewing ? screens[at + 1] : screens.slice(at + 1).find(open)
        const following = (next ?? screens.find(open))?.[0]
        reviewingAnswers.current = reviewing && !!following
        linkedQuestion.current = null
        enterLastPage.current = undefined
        // after the last answer, straight to the ID type picker: no second overview (Kush, 2026-11-18)
        void stepper.goTo(following ?? 'id')

        const submission = ++submissions.current
        if (!waitForSave && changed.length) saves.current = saves.current.then(persist).then(() => undefined)
        if (following) return
        // The last answer reserves the attempt: its save and a fresh read of the questions and the ID's documents
        // land before the picker offers a choice, so it shows current documents and closed features, and a quick
        // pick cannot race the save.
        const checkpointCurrent = () =>
            current() && submission === submissions.current && back === backRevision.current && !saveRefused.current
        setCheckpointPending(true)
        settled.current = saves.current.then(async () => {
            if (!checkpointCurrent()) return
            const [freshQuestions, freshPlan] = await Promise.all([
                readFlowQuestions(checkpointCurrent),
                readFlowPlan(),
            ])
            if (!checkpointCurrent() || stepRef.current !== 'id') return
            if (freshPlan) setPlan(freshPlan)
            const open = freshQuestions && resumeStep(freshQuestions)
            if (freshQuestions) setQuestions(freshQuestions)
            if (open) void stepper.goTo(screenOf(open))
            // every question answered and saved: the funnel's "questions complete" step
            else track(ANALYTICS_EVENTS.KYC_PV_SAVED_VIEWED)
        })
        void settled.current.finally(() => {
            if (submission === submissions.current) setCheckpointPending(false)
        })
    }

    // A cached open takes the server's read in as long as nothing was answered on top of it.
    useEffect(() => {
        if (!fresh || submissions.current) return
        setQuestions(fresh.questions)
        setPlan(fresh.plan)
        setStatus(fresh.status)
    }, [fresh, setStatus])
    // The next visit opens on what this one ends with.
    useEffect(() => {
        if (!candidate && user?.user.userId)
            queryClient.setQueryData([...PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY, user.user.userId], questions)
    }, [candidate, queryClient, questions, user?.user.userId])
    useEffect(() => {
        if (!candidate && user?.user.userId)
            queryClient.setQueryData([...PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, user.user.userId], plan)
    }, [candidate, queryClient, plan, user?.user.userId])
    useEffect(() => {
        if (!candidate && status && user?.user.userId)
            queryClient.setQueryData([...PAPERWORK_VERIFICATION_STATUS_QUERY_KEY, user.user.userId], status)
    }, [candidate, queryClient, status, user?.user.userId])

    const readFlowPlan = useCallback(async () => {
        if (!candidate) return findKycDocumentPlan('verify').catch(() => null)
        return readCandidatePlan(candidate).catch(() => null)
    }, [candidate])

    const readFlowQuestions = async (current: () => boolean = () => true) => {
        if (!candidate) return readQuestions(router, current)
        const questions = await getKycQuestions(candidate.feature, candidate.attemptId, current).catch(() => null)
        return questions?.available && questions.attemptId === candidate.attemptId ? questions : null
    }

    // A plan read before the attempt existed can lack the ID's documents: read it once more on the ID screen.
    const documentsReread = useRef(false)
    const [documentsLoading, setDocumentsLoading] = useState(false)
    const needsDocuments = step === 'id' && !identityDocuments(plan?.routes[0]).length
    useEffect(() => {
        if (!needsDocuments || documentsReread.current) return
        documentsReread.current = true
        setDocumentsLoading(true)
        void readFlowPlan().then((current) => {
            if (current) setPlan(current)
            setDocumentsLoading(false)
        })
    }, [needsDocuments, readFlowPlan])

    /** Back to the ID picker, on the documents the server offers now. */
    const backToDocuments = (error: string | null) => {
        setDocumentRequired(true)
        setStatus('NOT_STARTED')
        setSubmitted(false)
        setIdError(error)
        void readFlowPlan().then((current) => current && setPlan(current))
        void stepper.goTo('id')
    }

    /** Takes the user where a refused save points; false leaves them on the refused step. */
    const onConflict = (error: AnswerFormError, message?: string): boolean => {
        if (
            error === 'existing_verification' ||
            error === 'session_changed' ||
            (candidate && error === 'unavailable')
        ) {
            if (candidate && error !== 'session_changed') void reload()
            else router.replace('/home')
            return true
        }
        // The ID went in or the check ended (perhaps on another device), or the features changed:
        // the status and the questions are read again.
        if (
            error === 'unavailable' ||
            error === 'identity_submitted' ||
            error === 'verification_complete' ||
            error === 'feature_not_selected'
        ) {
            void reload()
            return true
        }
        if (error === 'document_not_allowed') {
            backToDocuments(message ?? null)
            return true
        }
        return false
    }

    const startIdentity = async (document?: { type: string; issuingCountry: string }) => {
        // the last answer's checkpoint first: its saves, and a fresh read of the attempt and the documents
        const back = backRevision.current
        const from = stepRef.current
        const session = captureSession()
        setSettling(true)
        await settled.current
        if (candidate && session.ready) await session.ready
        setSettling(false)
        if (
            back !== backRevision.current ||
            !session.current() ||
            stepRef.current !== from ||
            saveRefused.current ||
            (candidate && (latestStatus.current === 'APPROVED' || latestStatus.current === 'REJECTED'))
        )
            return
        setIdError(null)
        if (document) {
            const key = DOCUMENT_KEYS[document.type as keyof typeof DOCUMENT_KEYS]
            setIdentityStepTitle(key ? tDocuments(key) : undefined)
        }
        let attemptId =
            candidate?.attemptId ??
            identity.attemptIdRef.current ??
            questions.attemptId ??
            plan?.activeAttemptId ??
            null
        if (!attemptId) {
            const fresh = await readFlowQuestions(session.current)
            if (!session.current()) return
            if (fresh) setQuestions(fresh)
            attemptId = fresh?.attemptId ?? null
        }
        if (!attemptId) {
            setIdError(t('midpoint.failed'))
            return
        }
        const outcome = await identity.open(attemptId, document, candidate ? session.current : undefined)
        if (
            !session.current() ||
            (candidate && (latestStatus.current === 'APPROVED' || latestStatus.current === 'REJECTED'))
        )
            return
        if (outcome.kind !== 'busy')
            track(ANALYTICS_EVENTS.KYC_PV_ID_OUTCOME, {
                outcome: outcome.kind,
                retry: !document,
                ...(outcome.kind === 'questions-missing' && { missing_step: outcome.step }),
            })
        if (outcome.kind === 'opened') setQuestions((current) => ({ ...current, attemptId: outcome.attemptId }))
        if (outcome.kind === 'existing-verification') {
            if (candidate) void reload()
            else router.replace('/home')
        }
        if (outcome.kind === 'residence-not-supported') router.replace(RESIDENCE_NOT_SUPPORTED_PATH)
        if (outcome.kind === 'document-required') {
            setDocumentRequired(true)
            setStatus('NOT_STARTED')
            setSubmitted(false)
            if (outcome.message) setIdError(outcome.message)
            void stepper.goTo('id')
        }
        if (outcome.kind === 'document-not-allowed') backToDocuments(outcome.message ?? t('midpoint.failed'))
        if (outcome.kind === 'complete') void reload()
        if (outcome.kind === 'failed') setIdError(outcome.message ?? t('midpoint.failed'))
        if (outcome.kind === 'questions-missing') {
            setDocumentRequired(false)
            setStatus('NOT_STARTED')
            setSubmitted(false)
            const fresh = await readFlowQuestions(session.current)
            if (!session.current()) return
            if (fresh) setQuestions(fresh)
            const target = outcome.step ?? (fresh && resumeStep(fresh))
            if (target && outcome.message) setReturned({ step: target, message: outcome.message })
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
    }, [identity.documentRequired, goToStep, setStatus])

    // A check that answers after the selfie was sent finds the review: it must not reopen the choice.
    const sumsubOpenRef = useRef(false)
    sumsubOpenRef.current = !!identity.session && !submitted
    const checkIdentityDocument = async () => {
        const sdk = identity.session
        const session = captureSession()
        const attemptId = candidate?.attemptId ?? identity.attemptIdRef.current
        const declared = questions.residence
        if (!attemptId || !declared) return
        const mismatch = await getIdentityDocumentMismatch(attemptId)
        if (candidate) {
            if (
                !sdk ||
                activeSdk.current !== sdk ||
                !session.current() ||
                !mismatch ||
                latestStatus.current === 'APPROVED' ||
                latestStatus.current === 'REJECTED'
            )
                return
            activeSdk.current = null
            identity.close()
            backToDocuments(t('reverify.documentMismatch'))
            return
        }
        if (!mismatch || mismatch.recognised === declared || !sumsubOpenRef.current) return
        track(ANALYTICS_EVENTS.KYC_PV_DOCUMENT_COUNTRY_MISMATCH, {
            picked: mismatch.picked,
            recognised: mismatch.recognised,
        })
        identity.close()
        setDocumentMismatch({ declared, document: mismatch.recognised })
    }

    /** Keeping the declared country picks its ID again; the document's country becomes the residence. */
    const chooseDocumentCountry = async (country: string) => {
        if (!documentMismatch || mismatchBusy) return
        const keptDeclared = country === documentMismatch.declared
        track(ANALYTICS_EVENTS.KYC_PV_DOCUMENT_COUNTRY_CHOSEN, { kept_declared: keptDeclared })
        if (keptDeclared) {
            setDocumentMismatch(null)
            void stepper.goTo('id')
            return
        }
        setMismatchBusy(true)
        try {
            const userId = user?.user.userId
            const result = await updateUserById({ userId, residenceCountry: country })
            if (result.error) {
                setIdError(result.error)
                setDocumentMismatch(null)
                void stepper.goTo('id')
                return
            }
            storeDeclaredResidence(userId, country)
            // The questions follow the residence: the server rebuilds them for the new country.
            await Promise.resolve(fetchUser()).catch(() => {})
            await reload()
            setDocumentMismatch(null)
        } finally {
            setMismatchBusy(false)
        }
    }

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
        autoConnect: !candidate,
        onSumsubKycStatusUpdate: candidate ? undefined : (next) => setStatus(next as SumsubKycStatus),
    })
    useEffect(() => {
        if (candidate ? approved || status === 'REJECTED' : step !== 'review' || failed) return
        const controller = new AbortController()
        const fence = candidate ? captureSessionFence(user?.user.userId, () => !controller.signal.aborted) : null
        let reading = false
        let polls = 0
        const timer = setInterval(() => {
            // Every fourth poll asks the API to re-read Sumsub, so a lost webhook can't hold the review for hours.
            if (reading || fence?.current() === false) return
            reading = true
            const refresh = ++polls % REFRESH_EVERY_POLLS === 0 && step === 'review' && !failed
            const read = candidate
                ? refresh
                    ? refreshKycIdentityStatus(candidate.attemptId, controller.signal)
                    : getKycDocumentStatus(controller.signal, candidate.attemptId)
                : refresh
                  ? refreshKycIdentityStatus()
                  : getKycDocumentStatus()
            void read
                .then((next) => {
                    if (!next || controller.signal.aborted || fence?.current() === false) return
                    if (candidate && (latestStatus.current === 'APPROVED' || (submitted && next === 'NOT_STARTED')))
                        return
                    setStatus(candidate ? normalizeCandidateStatus(next) : next)
                })
                .catch(() => {})
                .finally(() => {
                    reading = false
                })
        }, STATUS_POLL_MS)
        return () => {
            controller.abort()
            clearInterval(timer)
        }
    }, [approved, candidate, step, failed, setStatus, status, submitted, user?.user.userId])
    // An approval that arrives during the visit, whether the review was opened here or on an earlier visit.
    // REVERIFYING preserves existing access but is not the replacement's decision.
    const decided = submitted || identity.session ? status === 'APPROVED' : approved
    useEffect(() => {
        if (!candidate) return
        if (approved || failed || status === 'IN_REVIEW') {
            try {
                sessionStorage.removeItem(candidateSubmissionKey(user?.user.userId, candidate.attemptId))
            } catch {
                // The server still owns the review state.
            }
        }
        if (status === 'ACTION_REQUIRED') setSubmitted(false)
        if (approved) {
            closeIdentity()
            void goToStep('verified')
        } else if (reviewing || failed) {
            if (status === 'REJECTED') {
                activeSdk.current = null
                closeIdentity()
            }
            void goToStep('review')
        }
    }, [candidate, approved, reviewing, failed, status, goToStep, closeIdentity, user?.user.userId])
    const approvedAtOpen = useRef(decided)
    const approvalHandled = useRef(false)
    useEffect(() => {
        if (candidate || !decided || approvedAtOpen.current || approvalHandled.current) return
        approvalHandled.current = true
        const session = captureSession()
        void fetchUser()
        void Promise.all([findKycDocumentPlan().catch(() => null), readQuestions(router, session.current)]).then(
            ([fresh, freshQuestions]) => {
                if (!session.current()) return
                const addLater = freshQuestions && featureOpenAfterApproval(freshQuestions, status)
                if (addLater) {
                    router.replace(paperworkVerificationFeaturePath(addLater))
                    return
                }
                if (fresh) setPlan(fresh)
                void stepper.goTo(fresh?.proofOfAddress === 'suggested' ? 'address-proof' : 'verified')
            }
        )
    }, [candidate, decided, fetchUser, stepper, status, router, captureSession])

    const tracking = useMemo<PaperworkVerificationTrackingContext>(
        () =>
            candidate
                ? {
                      flow: 'paperwork_verification',
                      residence: null,
                      purpose: 'reverify_for_feature',
                      feature: candidate.feature,
                  }
                : { flow: 'paperwork_verification', residence: questions.residence, features: plan?.features },
        [candidate, questions.residence, plan?.features]
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
        if (step === 'review') track(ANALYTICS_EVENTS.KYC_PV_REVIEW_VIEWED, { status: status ?? null })
        if (step === 'verified') track(ANALYTICS_EVENTS.KYC_PV_VERIFIED_VIEWED)
        if (step === 'address-proof') track(ANALYTICS_EVENTS.KYC_PV_POA_VIEWED)
        // A screen view per step change, and per review status while the review is in view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, step === 'review' ? status : null])
    const [residenceOpen, setResidenceOpen] = useState(false)
    // Mounted from the first opening on: its restriction fetch only runs for a user who asks to move.
    const [residenceMounted, setResidenceMounted] = useState(false)

    const goHome = () =>
        candidate ? router.replace('/home') : returnToFeature === '1' ? exit() : router.replace('/home')
    // First-time completion (submitted or verified) goes back where the check was opened from, when
    // that place passed a safe returnTo (the card step does); without one it ends as before. The user is
    // read again first, so that place sees the new verification status.
    const firstTimeReturn = candidate ? null : safeReverificationReturnTo(returnTo)
    // the read is a courtesy to the place returned to: a slow one never holds the user here past 3 s
    const returnToOpener = useCandidateReturn(firstTimeReturn, { waitMs: 3000, orElse: () => goHome() })
    const finish = () => void returnToOpener()
    const residenceName = questions.residence
        ? localizedCountryName(locale, questions.residence, questions.residence)
        : ''

    const current = questions.steps.find((s) => s.id === step)
    let screen: React.ReactNode = null
    if (documentMismatch) {
        screen = (
            <ResidenceCompare
                residence={documentMismatch.declared}
                nationality={documentMismatch.document}
                labelOf={(country) => localizedCountryName(locale, country, country)}
                restrictionSets={null}
                busy={mismatchBusy}
                onChoose={(country) => void chooseDocumentCountry(country)}
                description={t('documentMismatch.description')}
            />
        )
    } else if (showIntro) {
        screen = (
            <VerifyStartIntro
                controlScreen="steps-overview"
                questions={!allAnswered}
                verifyTestId="verify-steps-continue"
                onLater={remindLater}
                onVerify={() => {
                    track(ANALYTICS_EVENTS.KYC_PV_STEPS_CONTINUED, { next: step })
                    setIntro(false)
                }}
            />
        )
    } else if (current) {
        const shown = (screens.find((ids) => ids[0] === current.id) ?? [current.id])
            .map((id) => questions.steps.find((s) => s.id === id))
            .filter((s): s is PaperworkVerificationStep => !!s)
        const group = questionIds.indexOf(current.id)
        const startAtStep = shown.find((s) => s.id === linkedQuestion.current)?.id ?? resumeStep(questions)
        screen = (
            <QuestionStepScreen
                key={current.id}
                useDraft={!candidate}
                steps={shown}
                residence={questions.residence}
                progress={{
                    ...stepProgress(questionIds, current.id, pageCounts),
                    pages: pageCounts[group],
                }}
                startAtStep={startAtStep}
                startFromEnd={enterLastPage.current === current.id}
                onBack={backThroughQuestions}
                onSubmitted={(values, seconds) => submitAnswers(shown, values, seconds)}
                returned={returned && shown.some((s) => s.id === returned.step) ? returned : undefined}
                onConflict={onConflict}
                onContinueWithoutLocal={candidate ? undefined : continueWithoutLocal}
                onChangeResidence={
                    candidate
                        ? undefined
                        : () => {
                              setResidenceMounted(true)
                              setResidenceOpen(true)
                          }
                }
            />
        )
    } else if (step === 'id') {
        screen = (
            <IdentityDocumentScreen
                plan={plan}
                residence={questions.residence}
                nationality={nationalityOf(questions)}
                notice={<ClosedFeaturesNotice closed={questions.closed ?? []} />}
                documentsLoading={documentsLoading}
                busy={identity.busy || settling || checkpointPending}
                error={idError}
                progress={{ current: progressTotal, total: progressTotal }}
                onBack={backThroughQuestions}
                onExit={exit}
                onContinue={(document) => void startIdentity(document)}
                onChangeResidence={
                    candidate
                        ? undefined
                        : () => {
                              track(ANALYTICS_EVENTS.KYC_PV_RESIDENCE_CHANGE_OPENED, { step: 'id' })
                              setResidenceMounted(true)
                              setResidenceOpen(true)
                          }
                }
            />
        )
    } else if (step === 'review') {
        screen = failed ? (
            <ReviewScreen
                rejection={rejection}
                {...(candidate ? {} : rejectionExits)}
                copy={
                    candidate && !retryable
                        ? {
                              title: t('reverify.refusalTitle'),
                              description: t(
                                  candidate.feature === 'card'
                                      ? 'reverify.refusalCard'
                                      : candidate.feature === 'bank'
                                        ? 'reverify.refusalBank'
                                        : 'reverify.refusalLocal'
                              ),
                          }
                        : undefined
                }
                onHome={goHome}
                policyHold={policyHold}
                onRetry={
                    !policyHold && retryable && RETRY_ACTIONS.has(rejection.action)
                        ? () => {
                              track(ANALYTICS_EVENTS.KYC_PV_REVIEW_RETRY)
                              void startIdentity()
                          }
                        : undefined
                }
                busy={identity.busy}
                error={idError}
            />
        ) : (
            <StepsScreen
                phase="review"
                title={candidate ? t('reverify.pendingTitle') : undefined}
                note={candidate ? t('reverify.pendingDescription') : undefined}
                hasQuestions={questionIds.length > 0}
                // "Back to Home" would be false when the check returns to where it was opened from
                cta={firstTimeReturn ? t('continue') : undefined}
                onBack={finish}
                onContinue={finish}
            />
        )
    } else if (step === 'verified') {
        screen = (
            <StepsScreen
                phase="verified"
                hasQuestions={questionIds.length > 0}
                // The identity's own status page also names what a feature still asks for (Rain's
                // proof of address, a bank's document) as steps of its own, before Unlock. Opened with a
                // returnTo, Continue goes back to the opener, not to those steps, and the opener (the card
                // funding step) does not lead to each of them, so the screen does not list them.
                followUps={candidate || firstTimeReturn ? undefined : followUps.map((followUp) => followUp.label)}
                note={!candidate && !firstTimeReturn && followUps[0] ? tRoot(followUps[0].note) : undefined}
                // a returnTo target is not "payments": the neutral label is true for any place returned to
                cta={candidate || followUps[0] || firstTimeReturn ? t('continue') : undefined}
                aside={!candidate && bankRefusal && <BankRefusalNotice refusal={bankRefusal} />}
                onBack={finish}
                // opened with a returnTo (the card step): back there
                onContinue={
                    candidate
                        ? completeCandidate
                        : firstTimeReturn
                          ? finish
                          : () => router.push(followUps[0]?.href ?? PAYMENT_METHODS_HREF)
                }
            />
        )
    } else if (step === 'address-proof') {
        screen = (
            <ProofOfAddressStep
                residenceName={residenceName}
                temporaryProtection={plan?.proofOfAddressReason === 'temporary_protection'}
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

    if (plan?.unavailableReason === 'residence_not_supported') return <ResidenceNotSupportedScreen onBack={exit} />

    return (
        <PaperworkVerificationTrackingProvider value={tracking}>
            {screen}
            {residenceMounted && (
                <ResidenceChangeDrawer
                    visible={residenceOpen}
                    onClose={() => setResidenceOpen(false)}
                    userId={user?.user.userId}
                    declared={user?.residence?.declared?.country ?? questions.residence}
                    declaredSecond={user?.residence?.secondaryDeclaredCountry}
                    verified={user?.residence?.verified?.country ?? null}
                    pending={pendingResidenceCountry(user?.residence)}
                    pendingStatus={user?.residence?.declared?.status}
                    onContactSupport={modals ? () => modals.setIsSupportModalOpen(true) : undefined}
                    onSaved={async () => {
                        // The questions follow the residence: the server rebuilds them for the new country.
                        queueGeneration.current += 1
                        await Promise.resolve(fetchUser()).catch(() => {})
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
                identityStepTitle={identityStepTitle}
                onClose={() => {
                    if (identity.session && activeSdk.current !== identity.session) return
                    activeSdk.current = null
                    track(ANALYTICS_EVENTS.KYC_PV_IDENTITY_CLOSED)
                    identity.close()
                }}
                onComplete={() => {
                    const sdk = identity.session
                    if (!sdk || activeSdk.current !== sdk) return
                    const session = captureSession()
                    if (candidate && (!session.current() || latestStatus.current === 'REJECTED')) return
                    activeSdk.current = null
                    identity.close()
                    // An approval can arrive while the SDK is still closing. Its
                    // route may be a follow-up, so leave that decision in place.
                    if (latestStatus.current === 'APPROVED' || approvedSdk.current === sdk) return
                    track(ANALYTICS_EVENTS.KYC_PV_IDENTITY_SUBMITTED)
                    if (candidate) {
                        try {
                            sessionStorage.setItem(candidateSubmissionKey(user?.user.userId, candidate.attemptId), '1')
                        } catch {
                            // The mounted view can still show review while storage is unavailable.
                        }
                    }
                    setStatus('PENDING')
                    setSubmitted(true)
                    if (!candidate)
                        queryClient.setQueryData(
                            [...PAPERWORK_VERIFICATION_STATUS_QUERY_KEY, user?.user.userId],
                            'PENDING'
                        )
                    void stepper.goTo('review')
                    // Home reads the identity from the user: refreshed once the server has read Sumsub.
                    const read = candidate ? refreshKycIdentityStatus(candidate.attemptId) : refreshKycIdentityStatus()
                    void read
                        .then((next) => {
                            if (!session.current() || activeSdk.current) return
                            if (next && next !== 'NOT_STARTED' && latestStatus.current !== 'APPROVED')
                                setStatus(candidate ? normalizeCandidateStatus(next) : next)
                            if (!candidate || next === 'APPROVED') void fetchUser()
                        })
                        .catch(() => {})
                }}
                onRefreshToken={identity.refreshToken}
                onIdentityStepCompleted={() => void checkIdentityDocument()}
            />
        </PaperworkVerificationTrackingProvider>
    )
}

/** Rule 1's upload goes through the existing supplement action (`supplement:bridge`). */
function ProofOfAddressStep({
    residenceName,
    temporaryProtection,
    onDone,
    onUploadStarted,
}: {
    residenceName: string
    temporaryProtection: boolean
    onDone: (outcome: 'uploaded' | 'skipped') => void
    onUploadStarted: () => void
}) {
    const flow = useSumsubKycFlow({ onKycSuccess: () => onDone('uploaded') })
    return (
        <>
            <ProofOfAddressScreen
                residenceName={residenceName}
                temporaryProtection={temporaryProtection}
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
