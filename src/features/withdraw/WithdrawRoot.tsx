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
                              initialAmount: bankAmount.initialAmount,
                              initialDenomination: bankAmount.initialDenomination,
                              onAmountChange: bankAmount.onDestinationAmountChange,
                          }
                        : undefined
                }
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
