'use client'

import { type MutableRefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryState } from 'nuqs'
import { useToast } from '@/components/0_Bruddle/Toast'
import { setupSteps } from '@/components/Setup/Setup.consts'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { useSetupStepCopy } from '@/components/Setup/useSetupStepCopy'
import { updateUserById } from '@/app/actions/users'
import { savePaperworkVerificationFeatures } from '@/app/actions/kyc-paperwork-verification'
import type { KycPlanNeed } from '@/app/actions/types/kyc-workflow.types'
import { useAuth } from '@/context/authContext'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { featuresFromPaymentPlan } from '@/features/setup/paymentChannels'
import { SETUP_SCREEN_PARAM, useSetupFlow } from '@/hooks/useSetupFlow'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { VerifyLoading } from './LoadScreens'

const SCREEN_FOR_NEED: Record<KycPlanNeed, ScreenId> = { residence: 'residence', features: 'payment-plan' }
const PRELUDE_ORDER: KycPlanNeed[] = ['residence', 'features']

/**
 * An older account the plan cannot ask questions for yet: it has no declared
 * residence, or no plan for adding money and spending. Signup's own screens
 * collect them (the same components, copy and saves), then /verify reloads.
 */
export function VerifySetupPrelude({
    needs,
    onDone,
    onExit,
}: {
    needs: KycPlanNeed[]
    onDone: () => Promise<void>
    onExit: () => void
}) {
    const screens = useMemo(
        () => PRELUDE_ORDER.filter((need) => needs.includes(need)).map((need) => SCREEN_FOR_NEED[need]),
        [needs]
    )
    // The save reads the answers held inside the provider, so the provider gets a stable trampoline.
    const finish = useRef<() => Promise<void>>(async () => {})
    const onFinish = useCallback(() => finish.current(), [])
    return (
        <SetupFlowProvider masterScreenIds={screens} onFinish={onFinish}>
            <PreludeScreens screens={screens} needs={needs} onDone={onDone} onExit={onExit} finish={finish} />
        </SetupFlowProvider>
    )
}

function PreludeScreens({
    screens,
    needs,
    onDone,
    onExit,
    finish,
}: {
    screens: ScreenId[]
    needs: KycPlanNeed[]
    onDone: () => Promise<void>
    onExit: () => void
    finish: MutableRefObject<() => Promise<void>>
}) {
    const tCommon = useTranslations('common')
    const toast = useToast()
    const { user } = useAuth()
    const context = useSetupFlowContext()
    const { setSteps, setResidenceCountry, residenceCountry } = context
    const [, setScreenParam] = useQueryState(SETUP_SCREEN_PARAM)

    useLayoutEffect(() => setSteps(setupSteps.filter((step) => screens.includes(step.screenId))), [screens, setSteps])
    // the payment plan's options follow the residence, which a features-only visit already has
    const declared = user?.residence?.declared
    useLayoutEffect(() => {
        if (!needs.includes('residence') && declared && !residenceCountry) setResidenceCountry(declared)
    }, [needs, declared, residenceCountry, setResidenceCountry])

    const save = useCallback(async (): Promise<void> => {
        const failed = () => void toast.error(tCommon('genericError'))
        const userId = user?.user?.userId
        const { secondResidenceCountry, fundingChannel, paymentChannel } = context
        if (needs.includes('residence')) {
            const result = await updateUserById({
                userId,
                residenceCountry,
                ...(secondResidenceCountry ? { secondResidenceCountry } : {}),
            }).catch(() => ({ error: 'failed' }))
            if (!userId || result?.error) return failed()
            storeDeclaredResidence(userId, residenceCountry)
            storeSecondResidence(userId, secondResidenceCountry || null)
        }
        if (needs.includes('features') && fundingChannel && paymentChannel) {
            const result = await savePaperworkVerificationFeatures(
                featuresFromPaymentPlan(fundingChannel, paymentChannel)
            )
            if (result.kind === 'failed') return failed()
        }
        await setScreenParam(null)
        await onDone()
    }, [user, context, needs, residenceCountry, toast, tCommon, setScreenParam, onDone])
    useLayoutEffect(() => {
        finish.current = save
    }, [finish, save])

    return <PreludeStep screens={screens} onExit={onExit} />
}

function PreludeStep({ screens, onExit }: { screens: ScreenId[]; onExit: () => void }) {
    const { step, currentIndex, handleBack, setScreenId } = useSetupFlow()
    const copy = useSetupStepCopy(step)
    useEffect(() => {
        if (currentIndex < 0) setScreenId(screens[0], { history: 'replace' })
    }, [currentIndex, screens, setScreenId])
    if (!step) return <VerifyLoading onBack={onExit} />
    const View = step.component
    return (
        <SetupWrapper
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            {...copy}
            showBackButton
            // Back from the first screen leaves verification, as /verify's own first screen does.
            onBack={currentIndex === 0 ? onExit : handleBack}
            imageClassName={step.imageClassName}
            contentClassName={step.contentClassName}
            step={currentIndex}
            showProgress={false}
        >
            <View />
        </SetupWrapper>
    )
}
