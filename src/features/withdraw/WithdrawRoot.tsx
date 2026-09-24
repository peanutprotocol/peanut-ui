'use client'

import { useTranslations } from 'next-intl'
import RateGateScreen from '@/components/Global/RateUnavailable/RateGateScreen'
import { useWithdrawRootFlow } from './useWithdrawRootFlow'
import { WithdrawAmountView } from './views/WithdrawAmountView'
import { WithdrawMethodView } from './views/WithdrawMethodView'

/**
 * Root /withdraw flow: method → amount, both as named screen ids in the URL
 * (`?step=amount`). State machine lives in useWithdrawRootFlow; the views are
 * dumb. Downstream routes (/withdraw/crypto, /withdraw/manteca,
 * /withdraw/[country]/bank) receive the amount via `?amount=`.
 */
export default function WithdrawRoot() {
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const flow = useWithdrawRootFlow()

    if (flow.stepper.step === 'amount') {
        // A non-USD destination (EUR/GBP/MXN/COP — QA-49) needs its FX rate
        // before the amount input can open in that currency. Same gate as the
        // Manteca amount step's RateGateScreen (dev #2843/#1848: keep the
        // header mounted so back always works while the rate loads).
        const needsRate = flow.currencyCode !== 'USD' && !flow.isCryptoWithdraw
        if (needsRate && (flow.isFetchingExchangeRate || !flow.exchangeRate)) {
            return (
                <RateGateScreen
                    title={flow.isFromSendFlow ? tNav('send') : tNav('withdraw')}
                    onBack={flow.handleAmountBack}
                    isLoading={flow.isFetchingExchangeRate}
                    onRetry={flow.refetchRate}
                />
            )
        }
        return (
            <WithdrawAmountView
                pageTitle={flow.isFromSendFlow ? tNav('send') : tNav('withdraw')}
                heading={flow.isFromSendFlow ? t('amountToSend') : t('amountToWithdraw')}
                initialAmount={flow.rawTokenAmount}
                walletBalance={flow.walletBalance}
                balanceFillAmount={flow.maxDecimalAmount}
                onBalanceFilled={flow.handleBalanceFilled}
                onAmountChange={flow.handleAmountChange}
                onBack={flow.handleAmountBack}
                onContinue={flow.handleAmountContinue}
                continueDisabled={flow.continueDisabled}
                error={flow.error}
                isCryptoWithdraw={flow.isCryptoWithdraw}
                limitsValidation={flow.limitsValidation}
                destinationCurrency={flow.currencyCode}
                destinationRate={flow.exchangeRate}
            />
        )
    }

    return (
        <WithdrawMethodView
            pageTitle={flow.isBankFromSend ? tNav('send') : tNav('withdraw')}
            mainHeading={flow.isBankFromSend ? t('howWouldYouLikeToSend') : t('howWouldYouLikeToWithdraw')}
            onExit={() => void flow.stepper.back()}
            onMethodChosen={() => void flow.stepper.goTo('amount')}
        />
    )
}
