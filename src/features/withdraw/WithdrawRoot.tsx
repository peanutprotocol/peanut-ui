'use client'

import { useTranslations } from 'next-intl'
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
        return (
            <WithdrawAmountView
                pageTitle={flow.isFromSendFlow ? tNav('send') : tNav('withdraw')}
                heading={flow.isFromSendFlow ? t('amountToSend') : t('amountToWithdraw')}
                initialAmount={flow.rawTokenAmount}
                walletBalance={flow.walletBalance}
                onAmountChange={flow.handleAmountChange}
                onBack={flow.handleAmountBack}
                onContinue={flow.handleAmountContinue}
                continueDisabled={flow.continueDisabled}
                error={flow.error}
                isCryptoWithdraw={flow.isCryptoWithdraw}
                limitsValidation={flow.limitsValidation}
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
