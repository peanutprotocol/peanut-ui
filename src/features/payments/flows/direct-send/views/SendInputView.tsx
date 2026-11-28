'use client'

/**
 * input view for send flow
 *
 * displays:
 * - recipient card (peanut username)
 * - amount input
 * - optional message/file attachment
 * - payment method options
 *
 * executes payment directly on submit (no confirm step)
 */

import NavHeader from '@/components/Global/NavHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Callout } from '@/components/0_Bruddle/Callout'
import CooldownErrorText from '@/components/Global/RainCooldown/CooldownErrorText'
import AmountInput from '@/components/Global/AmountInput'
import UserCard from '@/components/User/UserCard'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import SupportCTA from '@/components/Global/SupportCTA'
import { useDirectSendFlow } from '../useDirectSendFlow'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useAuth } from '@/context/authContext'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useAddMoneyAction } from '@/features/add-money/drawer/useAddMoneyAction'
import { formatBankAmount } from '@/utils/currency'

export function SendInputView() {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')
    const tCommon = useTranslations('common')
    const tAdd = useTranslations('addMoney')
    const tCard = useTranslations('card.addMoney')
    const { isFetchingUser } = useAuth()
    const {
        amount,
        recipient,
        attachment,
        error,
        formattedBalance,
        balanceFillAmount,
        liveSpendableUsd,
        isSpendableBalanceSettled,
        canProceed,
        hasSufficientBalance,
        isInsufficientBalance,
        isLoggedIn,
        isLoading,
        setAmount,
        setAttachment,
        executePayment,
    } = useDirectSendFlow()

    // a short balance adds the gap in place (TASK-25467): the drawer comes back to this URL, amount in it
    const addMoney = useAddMoneyAction({
        place: 'send',
        targetUsd: parseFloat(amount) || 0,
        spendableUsd: liveSpendableUsd,
        balanceSettled: isSpendableBalanceSettled,
        step: `${recipient?.username ?? ''}:${amount}`,
        urlState: { amount },
    })

    // handle submit - directly execute payment
    const handleSubmit = () => {
        if (canProceed && hasSufficientBalance && !isLoading) {
            executePayment()
        }
    }

    // determine button text and state. A known short balance keeps a CTA on: "Add $X" opens the
    // add-money drawer here (TASK-23929, TASK-25467)
    const isButtonDisabled = !canProceed || (isLoggedIn && !hasSufficientBalance && !isInsufficientBalance) || isLoading
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    return (
        <div className="flex min-h-inherit flex-col justify-between gap-8">
            <NavHeader onPrev={onBack} title={t('headers.send')} />

            <PageStack.Center className="gap-4">
                {/* recipient card */}
                {recipient && (
                    <UserCard
                        type="send"
                        username={recipient.username}
                        fullName={recipient.fullName}
                        recipientType="USERNAME"
                        isVerified={recipient.isVerified}
                        person={recipient.person}
                    />
                )}

                {/* amount input + its field error form one column, 4px apart */}
                <div className="flex flex-col gap-1">
                    <AmountInput
                        initialAmount={amount}
                        setPrimaryAmount={setAmount}
                        onSubmit={handleSubmit}
                        walletBalance={isLoggedIn ? formattedBalance : undefined}
                        balanceFillAmount={isLoggedIn ? balanceFillAmount : undefined}
                        hideBalance={!isLoggedIn}
                        hideCurrencyToggle={true}
                    />
                    {isInsufficientBalance && !addMoney.bankSent && (
                        <FieldError>{t('errors.insufficientPayment')}</FieldError>
                    )}
                </div>

                {/* message input */}
                <BaseInput
                    placeholder={tCommon('comment')}
                    value={attachment.message}
                    maxLength={140}
                    onChange={(e) =>
                        setAttachment({
                            message: e.target.value,
                            file: attachment.file,
                            fileUrl: attachment.fileUrl,
                        })
                    }
                />

                {/* button and error */}
                <div className="space-y-4">
                    {addMoney.bankSent && (
                        <div className="flex flex-col items-center gap-2">
                            <Callout priority="info" className="w-full" data-testid="send-add-money-bank-sent">
                                {addMoney.bankSent.usd
                                    ? tCard('bankSentPending', {
                                          amount: formatBankAmount(addMoney.bankSent.usd, 'USD'),
                                      })
                                    : tCard('bankSentPendingNoAmount')}
                            </Callout>
                            <LinkButton onClick={addMoney.openAddMoney} data-testid="send-add-money-another-way">
                                {tAdd('anotherWay')}
                            </LinkButton>
                        </div>
                    )}
                    {/* a transfer on its way: Send waits, off, and turns on once the balance covers it */}
                    {isInsufficientBalance && !addMoney.bankSent ? (
                        <Button
                            variant="primary"
                            shadowSize="4"
                            className="w-full"
                            icon="arrow-down"
                            onClick={addMoney.openAddMoney}
                            data-testid="send-add-money"
                        >
                            {addMoney.gapUsd
                                ? tAdd('addAmount', { amount: formatBankAmount(addMoney.gapUsd, 'USD') })
                                : tAdd('title')}
                        </Button>
                    ) : (
                        <SendWithPeanutCta
                            onClick={handleSubmit}
                            disabled={isButtonDisabled || (isLoggedIn && !hasSufficientBalance)}
                            loading={isLoading}
                        />
                    )}
                    {addMoney.drawer}
                    {error.showError && (
                        <Callout priority="error">
                            <CooldownErrorText message={error.errorMessage} />
                        </Callout>
                    )}
                </div>

                {/* action list for non-logged in users */}
                {!isLoggedIn && !isFetchingUser && <PaymentMethodActionList isAmountEntered={isAmountEntered} />}
            </PageStack.Center>

            {/* support cta for guest users */}
            {!isLoggedIn && !isFetchingUser && <SupportCTA />}
        </div>
    )
}
