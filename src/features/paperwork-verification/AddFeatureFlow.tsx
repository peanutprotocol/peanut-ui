'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import {
    getKycQuestions,
    savePaperworkVerificationFeatures,
    type FeatureIntentsResult,
} from '@/app/actions/kyc-paperwork-verification'
import { getKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import type {
    PaperworkVerificationFeature,
    PaperworkVerificationStep,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    stepsLabel,
    trackPaperworkVerification,
    PaperworkVerificationTrackingProvider,
    type PaperworkVerificationTrackingContext,
} from './analytics'
import { QuestionStepScreen } from './components/QuestionStepScreen'
import { composeScreens, phoneJoinsAddress, RESIDENCE_CHANGE_HREF } from './paperworkVerification.utils'
import { FeatureReadyScreen } from './components/StatusScreens'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'

/** Adds the feature to the saved set once its answers are in; a feature already there is left as is. */
export async function addKycFeature(feature: PaperworkVerificationFeature): Promise<FeatureIntentsResult> {
    const plan = await getKycDocumentPlan()
    return savePaperworkVerificationFeatures(
        { ...plan.features, [feature]: true },
        { ...plan.features, [feature]: false }
    )
}

type State =
    | { kind: 'loading' }
    | { kind: 'failed' }
    | { kind: 'refused'; copy: string; feature: string }
    | { kind: 'action-required'; action: string }
    | { kind: 'asking'; screens: PaperworkVerificationStep[][]; at: number; residence: string | null }

/** A saved screen keeps its answers, so Back shows them. */
const withValues = (screen: PaperworkVerificationStep[], values: Record<string, string>) =>
    screen.map((step) => ({
        ...step,
        fields: step.fields.map((f) => (f.key in values ? { ...f, value: values[f.key] } : f)),
    }))

/**
 * A feature added after the ID check: the answers that feature still misses,
 * on the main flow's screens (pickers never share a screen with typed fields),
 * then the feature joins the saved set and the providers take it from there.
 * Never a new ID check.
 */
export function AddFeatureQuestions({
    feature,
    requiredStep,
    onBack,
    onDone,
}: {
    feature: PaperworkVerificationFeature
    /** A step the caller was told is missing (the card application); asked even when the read says answered. */
    requiredStep?: string | null
    onBack: () => void
    onDone: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const tKyc = useTranslations('kyc')
    const router = useRouter()
    const [state, setState] = useState<State>({ kind: 'loading' })
    const [residence, setResidence] = useState<string | null>(null)
    const tracking = useMemo<PaperworkVerificationTrackingContext>(
        () => ({ flow: 'add_later', feature, residence }),
        [feature, residence]
    )
    const trackingRef = useRef(tracking)
    trackingRef.current = tracking
    const track = useCallback(
        (event: Parameters<typeof trackPaperworkVerification>[1], properties?: Record<string, unknown>) =>
            trackPaperworkVerification(trackingRef.current, event, properties),
        []
    )
    // Called once per finish, whatever the parent re-renders with.
    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone
    const routerRef = useRef(router)
    routerRef.current = router
    const loadRef = useRef<(required?: string | null) => Promise<void>>(async () => {})
    const firstRequired = useRef(requiredStep)

    const finish = useCallback(
        async (afterRequired?: string | null) => {
            try {
                const result = await addKycFeature(feature)
                track(ANALYTICS_EVENTS.KYC_PV_ADD_FEATURE_OUTCOME, {
                    outcome: result.kind,
                    ...(result.kind === 'refused' && { refused_for: result.feature, refused_reason: result.copy }),
                    ...(result.kind === 'questions-missing' && { missing_step: result.step }),
                })
                if (result.kind === 'saved') onDoneRef.current()
                else if (result.kind === 'card-application') routerRef.current.push('/card')
                else if (result.kind === 'refused' || result.kind === 'action-required') setState(result)
                // A step asked a second time with nothing new to answer would loop: stop on the failure screen.
                else if (result.kind === 'questions-missing' && result.step !== afterRequired)
                    await loadRef.current(result.step)
                else setState({ kind: 'failed' })
            } catch {
                track(ANALYTICS_EVENTS.KYC_PV_ADD_FEATURE_OUTCOME, { outcome: 'failed' })
                setState({ kind: 'failed' })
            }
        },
        [feature, track]
    )

    const load = useCallback(
        async (required?: string | null) => {
            setState({ kind: 'loading' })
            try {
                const questions = await getKycQuestions(feature)
                const steps = questions.steps.filter((s) => !s.answered || s.id === required)
                setResidence(questions.residence)
                trackingRef.current = { ...trackingRef.current, residence: questions.residence }
                track(ANALYTICS_EVENTS.KYC_PV_ADD_FEATURE_VIEWED, {
                    steps: stepsLabel(steps),
                    missing_steps: steps.length,
                    asked_again: !!required,
                })
                if (!steps.length) return finish(required)
                const asked = { ...questions, steps }
                const screens = composeScreens(asked, phoneJoinsAddress(asked)).map((ids) =>
                    steps.filter((s) => ids.includes(s.id))
                )
                setState({ kind: 'asking', screens, at: 0, residence: questions.residence })
            } catch {
                track(ANALYTICS_EVENTS.KYC_PV_LOAD_FAILED)
                setState({ kind: 'failed' })
            }
        },
        [feature, finish, track]
    )
    loadRef.current = load

    useEffect(() => {
        void load(firstRequired.current)
    }, [load])

    if (state.kind === 'loading')
        return (
            <div className="flex h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] w-full items-center justify-center bg-white">
                <Loading variant="mascot" />
            </div>
        )
    if (state.kind === 'action-required')
        return <FeatureAction action={state.action} onBack={onBack} onDone={() => onDoneRef.current()} />
    if (state.kind === 'refused')
        return (
            <VerifyHeroLayout
                pose="sad"
                onBack={onBack}
                title={t(`addLater.title.${feature}`)}
                description={tKyc(
                    state.copy as never,
                    { feature: tKyc(`documents.${state.feature}` as never) } as never
                )}
                footer={
                    <VerifyFooter
                        actions={
                            <Button className="w-full" onClick={onBack}>
                                {t('addLater.doneCta')}
                            </Button>
                        }
                    />
                }
            />
        )
    if (state.kind === 'failed')
        return (
            <VerifyHeroLayout
                pose="sad"
                onBack={onBack}
                title={t('loadFailed.title')}
                description={t('loadFailed.description')}
                footer={
                    <VerifyFooter
                        actions={
                            <Button shadowSize="4" className="w-full" onClick={() => void load(firstRequired.current)}>
                                {t('loadFailed.retry')}
                            </Button>
                        }
                    />
                }
            />
        )
    return (
        <PaperworkVerificationTrackingProvider value={tracking}>
            <QuestionStepScreen
                key={state.at}
                steps={state.screens[state.at]}
                residence={state.residence}
                feature={feature}
                title={t(`addLater.title.${feature}`)}
                onBack={() => (state.at ? setState({ ...state, at: state.at - 1 }) : onBack())}
                onSaved={(_next, values) => {
                    if (state.at < state.screens.length - 1) {
                        const screens = state.screens.map((screen, i) =>
                            i === state.at ? withValues(screen, values) : screen
                        )
                        setState({ ...state, screens, at: state.at + 1 })
                        return
                    }
                    setState({ kind: 'loading' })
                    void finish()
                }}
                onConflict={(error) =>
                    error === 'unavailable' || error === 'existing_verification' ? onBack() : void load()
                }
                // A verified user's move needs a new residence check, which Accounts runs.
                onChangeResidence={() => router.push(RESIDENCE_CHANGE_HREF)}
            />
        </PaperworkVerificationTrackingProvider>
    )
}

function FeatureAction({ action, onBack, onDone }: { action: string; onBack: () => void; onDone: () => void }) {
    const t = useTranslations('kyc.paperworkVerification')
    const flow = useSumsubKycFlow({ onKycSuccess: onDone })
    const started = useRef(false)
    useEffect(() => {
        if (started.current) return
        started.current = true
        void flow.handleStartAction(action)
    }, [action, flow])
    return (
        <>
            <VerifyHeroLayout
                pose="thinking"
                onBack={onBack}
                title={t('addLater.actionTitle')}
                description={flow.error ?? t('addLater.actionDescription')}
                footer={
                    <VerifyFooter
                        actions={
                            <Button
                                className="w-full"
                                loading={flow.isLoading}
                                disabled={flow.isLoading}
                                onClick={() => void flow.handleStartAction(action)}
                            >
                                {t('continue')}
                            </Button>
                        }
                    />
                }
            />
            <SumsubKycWrapper
                visible={flow.showWrapper}
                accessToken={flow.accessToken}
                onClose={flow.handleClose}
                onComplete={() => {
                    flow.handleSdkComplete()
                    onDone()
                }}
                onRefreshToken={flow.refreshToken}
            />
        </>
    )
}

/** /verify?feature=…: the add-later screen, then the "all set" screen back to where the user came from. */
export function AddFeatureFlow({ feature, onExit }: { feature: PaperworkVerificationFeature; onExit: () => void }) {
    const [ready, setReady] = useState(false)
    const done = useCallback(() => setReady(true), [])
    if (ready) return <FeatureReadyScreen feature={feature} onDone={onExit} />
    return <AddFeatureQuestions feature={feature} onBack={onExit} onDone={done} />
}
