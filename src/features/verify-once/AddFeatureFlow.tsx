'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import { getKycQuestions, saveVerifyOnceFeatures, type FeatureIntentsResult } from '@/app/actions/kyc-verify-once'
import { getKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import type { VerifyOnceFeature, VerifyOnceStep } from '@/app/actions/types/kyc-verify-once.types'
import { QuestionStepScreen } from './components/QuestionStepScreen'
import { FeatureReadyScreen } from './components/StatusScreens'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'

/** Adds the feature to the saved set once its answers are in; a feature already there is left as is. */
export async function addKycFeature(feature: VerifyOnceFeature): Promise<FeatureIntentsResult> {
    const plan = await getKycDocumentPlan()
    return saveVerifyOnceFeatures({ ...plan.features, [feature]: true }, { ...plan.features, [feature]: false })
}

type State =
    | { kind: 'loading' }
    | { kind: 'failed' }
    | { kind: 'refused'; copy: string; feature: string }
    | { kind: 'action-required'; action: string }
    | { kind: 'asking'; steps: VerifyOnceStep[]; residence: string | null }

/**
 * A feature added after the ID check: one screen with every answer that
 * feature still misses, then the feature joins the saved set and the
 * providers take it from there. Never a new ID check.
 */
export function AddFeatureQuestions({
    feature,
    requiredStep,
    onBack,
    onDone,
}: {
    feature: VerifyOnceFeature
    /** A step the caller was told is missing (the card application); asked even when the read says answered. */
    requiredStep?: string | null
    onBack: () => void
    onDone: () => void
}) {
    const t = useTranslations('kyc.verifyOnce')
    const tKyc = useTranslations('kyc')
    const [state, setState] = useState<State>({ kind: 'loading' })
    // Called once per finish, whatever the parent re-renders with.
    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone
    const loadRef = useRef<(required?: string | null) => Promise<void>>(async () => {})
    const firstRequired = useRef(requiredStep)

    const finish = useCallback(
        async (afterRequired?: string | null) => {
            try {
                const result = await addKycFeature(feature)
                if (result.kind === 'saved') onDoneRef.current()
                else if (result.kind === 'refused' || result.kind === 'action-required') setState(result)
                // A step asked a second time with nothing new to answer would loop: stop on the failure screen.
                else if (result.kind === 'questions-missing' && result.step !== afterRequired)
                    await loadRef.current(result.step)
                else setState({ kind: 'failed' })
            } catch {
                setState({ kind: 'failed' })
            }
        },
        [feature]
    )

    const load = useCallback(
        async (required?: string | null) => {
            setState({ kind: 'loading' })
            try {
                const questions = await getKycQuestions(feature)
                const steps = questions.steps.filter((s) => !s.answered || s.id === required)
                if (!steps.length) return finish(required)
                setState({ kind: 'asking', steps, residence: questions.residence })
            } catch {
                setState({ kind: 'failed' })
            }
        },
        [feature, finish]
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
        <QuestionStepScreen
            steps={state.steps}
            residence={state.residence}
            feature={feature}
            title={t(`addLater.title.${feature}`)}
            onBack={onBack}
            onSaved={() => {
                setState({ kind: 'loading' })
                void finish()
            }}
            onConflict={(error) =>
                error === 'unavailable' || error === 'existing_verification' ? onBack() : void load()
            }
        />
    )
}

function FeatureAction({ action, onBack, onDone }: { action: string; onBack: () => void; onDone: () => void }) {
    const t = useTranslations('kyc.verifyOnce')
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
export function AddFeatureFlow({ feature, onExit }: { feature: VerifyOnceFeature; onExit: () => void }) {
    const [ready, setReady] = useState(false)
    const done = useCallback(() => setReady(true), [])
    if (ready) return <FeatureReadyScreen feature={feature} onDone={onExit} />
    return <AddFeatureQuestions feature={feature} onBack={onExit} onDone={done} />
}
