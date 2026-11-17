'use client'

import posthog from 'posthog-js'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { useAuth } from '@/context/authContext'
import { setupChannelsForResidence } from '@/features/setup/paymentChannels'
import { saveSignupPaymentPlan } from '@/features/setup/saveSignupAnswers'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { usePlanOptionsSettled } from '@/features/setup/usePlanOptionsSettled'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useKycIntents } from '@/hooks/useKycIntents'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { Icon } from '@/components/Global/Icons/Icon'
import { useInfoLineOption } from '@/components/Setup/redesign/shell/useInfoLineOption'
import { WhyWeAskSheet } from '@/features/paperwork-verification/components/WhyWeAskSheet'
import { PlanArt, type PlanHop } from './PlanArt'
import { PlanSentence } from './PlanSentence'

/**
 * 08 Payment plan (step `payment-plan`): how the user adds money and spends it, as a sentence with two pills. The
 * options follow the residence (server answer first, restriction tiers when it failed). While they load the pills
 * wait and Continue is off; a spending list with one option arrives filled in. Saves and analytics as dev's view.
 */
export function PaymentPlanScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const { residenceCountry, fundingChannel, setFundingChannel, paymentChannel, setPaymentChannel, onFinish } =
        useSetupFlowContext()
    const { handleNext, isLoading } = useSetupFlow()
    const { user } = useAuth()
    const { sets, settled: setsSettled } = useResidenceRestrictionSetsWithStatus()
    const { track } = useSignupControl()
    const device = useShellDevice()
    const { intents, settled: intentsSettled } = useKycIntents(residenceCountry)
    const [hop, setHop] = useState<PlanHop>(null)
    const infoLine = useInfoLineOption()
    // The server's answer for the residence, the tiers when it could not be read, the universal options when neither.
    const settled = usePlanOptionsSettled({ intentsSettled, hasIntents: !!intents, setsSettled })
    const options = useMemo(
        () => setupChannelsForResidence(sets, residenceCountry, settled, intents),
        [sets, residenceCountry, settled, intents]
    )
    const funding = settled && fundingChannel && options.funding.includes(fundingChannel) ? fundingChannel : null
    const payment = settled && paymentChannel && options.payment.includes(paymentChannel) ? paymentChannel : null

    // A changed residence can remove a choice made on an earlier visit. A single spending option arrives filled in
    // (a19), in the context so the draft and the save carry it; adding money is never filled in for the user.
    useEffect(() => {
        if (!settled || !residenceCountry.trim()) return
        if (fundingChannel && !options.funding.includes(fundingChannel)) setFundingChannel(null)
        if (paymentChannel && options.payment.includes(paymentChannel)) return
        const only = options.payment.length === 1 ? options.payment[0] : null
        if (paymentChannel !== only) setPaymentChannel(only)
    }, [settled, residenceCountry, fundingChannel, setFundingChannel, paymentChannel, setPaymentChannel, options])

    const onContinue = () => {
        if (!funding || !payment) return
        track('continue', 'tap')
        if (sets?.full.has(residenceCountry)) {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED, {
                residence_country: residenceCountry,
            })
        }
        // Saved on Next like the residence; the verify prelude (onFinish) saves its own pick.
        const userId = user?.user?.userId
        if (userId && !onFinish) saveSignupPaymentPlan(userId, funding, payment)
        void handleNext()
    }

    const state = !settled
        ? 'loading'
        : isLoading
          ? 'advancing'
          : funding && payment
            ? 'filled'
            : !funding && payment && options.payment.length === 1
              ? 'prefilled'
              : 'default'
    const compact = device === 'sm'
    // QR payments run on Manteca: Argentina and Brazil only (FLEET-RULES 9)
    const qrHome = isMantecaSupportedCountryCode(residenceCountry)
    // The one helper line (Konrad, addendum 2): more ways to pay can be unlocked later, so the choice is not a hard one.
    const helper = (
        <p
            className="mt-3 flex items-center gap-1 text-body-xs text-foreground-secondary signup-sm:mt-2"
            data-testid="setup-plan-change-later"
        >
            <Icon name="info" size={16} className="shrink-0" />
            {t('plan.changeLater')}
        </p>
    )
    // TEMPORARY (TASK-25063): option b adds a "Why these options?" sheet that holds "Options depend on your residence."
    const whyLink =
        infoLine === 'b' ? (
            <WhyWeAskSheet
                link={t('plan.whyOptions')}
                title={t('plan.whyOptionsTitle')}
                reasons={[t('plan.hint')]}
                testId="setup-plan-why"
                onOpen={() => track('why', 'open')}
                onDismiss={() => track('why', 'dismiss')}
                onGotIt={() => track('why_got_it', 'tap')}
            />
        ) : undefined
    return (
        <SetupScreen
            ground="sky"
            stage={compact ? 'compact' : 'std'}
            artTop={214}
            smScale={0.55}
            state={state}
            title={t('plan.title')}
            art={<PlanArt compact={compact} hop={hop} showQr={qrHome} />}
            footer={{
                primary: {
                    label: t('common.continue'),
                    onClick: onContinue,
                    disabled: !settled || !funding || !payment || isLoading,
                    loading: isLoading,
                },
                slot: whyLink,
            }}
        >
            <PlanSentence
                funding={funding}
                payment={payment}
                fundingOptions={options.funding}
                paymentOptions={options.payment}
                bankCurrencies={intents?.bank.currencies ?? []}
                loading={!settled}
                qrAbroad={!qrHome}
                helper={helper}
                onFunding={(channel) => {
                    setFundingChannel(channel)
                    setHop((last) => ({ piece: 'coin', beat: (last?.beat ?? 0) + 1 }))
                }}
                onPayment={(channel) => {
                    setPaymentChannel(channel)
                    setHop((last) => ({
                        piece: channel === 'card' ? 'card' : channel === 'qr' ? 'qr' : 'coin',
                        beat: (last?.beat ?? 0) + 1,
                    }))
                }}
            />
        </SetupScreen>
    )
}
