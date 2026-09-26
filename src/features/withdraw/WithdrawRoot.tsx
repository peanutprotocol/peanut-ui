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
 * /withdraw/[country]/bank) receive the amount via `?amount=`, or the typed
 * bank amount via `?destinationAmount=` (EUR, GBP, MXN, COP accounts).
 */
export default function WithdrawRoot() {
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const flow = useWithdrawRootFlow()

    // on its way to /withdraw/crypto: render nothing rather than a screen the user never chose
    if (flow.forwardsToCrypto) return null

    if (flow.stepper.step === 'amount') {
        const pageTitle = flow.isFromSendFlow ? tNav('send') : tNav('withdraw')
        const { bankAmount } = flow
        // the bank-currency input converts with the quote rate: wait for it, and
        // keep the header so back always works (same gate as Manteca)
        if (bankAmount && !bankAmount.rate) {
            return (
                <RateGateScreen
                    title={pageTitle}
                    onBack={flow.handleAmountBack}
                    isLoading={!bankAmount.rateFailed}
                    onRetry={() => void bankAmount.refetchRate()}
                />
            )
        }
        return (
            <WithdrawAmountView
                pageTitle={pageTitle}
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
                bankAmount={
                    bankAmount?.rate
                        ? {
                              currency: bankAmount.currency.toUpperCase(),
                              rate: Number(bankAmount.rate),
                              // back or refresh restores the field in the currency it was typed in
                              initialAmount: bankAmount.isInUsd ? flow.rawTokenAmount : bankAmount.destinationAmount,
                              initialDenomination: bankAmount.isInUsd ? 'USD' : bankAmount.currency.toUpperCase(),
                              onAmountChange: bankAmount.onDestinationAmountChange,
                              onDenominationChange: bankAmount.onDenominationChange,
                          }
                        : undefined
                }
            />
        )
    }

    return (
        <WithdrawMethodView
            pageTitle={flow.isBankFromSend ? tNav('send') : tNav('withdraw')}
            onExit={() => void flow.stepper.back()}
            onMethodChosen={() => void flow.stepper.goTo('amount')}
        />
    )
}
