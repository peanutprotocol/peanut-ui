'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import { getKycQuestions } from '@/app/actions/kyc-verify-once'
import { getKycDocumentPlan, saveKycFeatures } from '@/app/actions/kyc-workflow'
import type { VerifyOnceFeature, VerifyOnceStep } from '@/app/actions/types/kyc-verify-once.types'
import { QuestionStepScreen } from './components/QuestionStepScreen'
import { FeatureReadyScreen } from './components/StatusScreens'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'
import { openSteps } from './verifyOnce.utils'

/** Adds the feature to the saved set once its answers are in; a feature already there is left as is. */
export async function addKycFeature(feature: VerifyOnceFeature) {
    const plan = await getKycDocumentPlan()
    if (!plan.features[feature]) await saveKycFeatures({ ...plan.features, [feature]: true })
}

type State =
    | { kind: 'loading' }
    | { kind: 'failed' }
    | { kind: 'asking'; steps: VerifyOnceStep[]; residence: string | null }

/**
 * A feature added after the ID check: one screen with every answer that
 * feature still misses, then the feature joins the saved set and the
 * providers take it from there. Never a new ID check.
 */
export function AddFeatureQuestions({
    feature,
    onBack,
    onDone,
}: {
    feature: VerifyOnceFeature
    onBack: () => void
    onDone: () => void
}) {
    const t = useTranslations('kyc.verifyOnce')
    const [state, setState] = useState<State>({ kind: 'loading' })
    // Called once per finish, whatever the parent re-renders with.
    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone

    const finish = useCallback(async () => {
        try {
            await addKycFeature(feature)
            onDoneRef.current()
        } catch {
            setState({ kind: 'failed' })
        }
    }, [feature])

    const load = useCallback(async () => {
        setState({ kind: 'loading' })
        try {
            const questions = await getKycQuestions(feature)
            const steps = openSteps(questions)
            if (!steps.length) return finish()
            setState({ kind: 'asking', steps, residence: questions.residence })
        } catch {
            setState({ kind: 'failed' })
        }
    }, [feature, finish])

    useEffect(() => {
        void load()
    }, [load])

    if (state.kind === 'loading')
        return (
            <div className="flex h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] w-full items-center justify-center bg-white">
                <Loading variant="mascot" />
            </div>
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
                            <Button shadowSize="4" className="w-full" onClick={() => void load()}>
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
            description={t('addLater.description')}
            onBack={onBack}
            onSaved={() => {
                setState({ kind: 'loading' })
                void finish()
            }}
            onConflict={() => void load()}
        />
    )
}

/** /verify?feature=…: the add-later screen, then the "all set" screen back to where the user came from. */
export function AddFeatureFlow({ feature, onExit }: { feature: VerifyOnceFeature; onExit: () => void }) {
    const [ready, setReady] = useState(false)
    const done = useCallback(() => setReady(true), [])
    if (ready) return <FeatureReadyScreen feature={feature} onDone={onExit} />
    return <AddFeatureQuestions feature={feature} onBack={onExit} onDone={done} />
}
