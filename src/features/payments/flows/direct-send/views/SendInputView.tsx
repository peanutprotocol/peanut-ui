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
import UserCard from '@/components/User/UserCard'
import SupportCTA from '@/components/Global/SupportCTA'
import { SendAmountKeypad } from '../components/SendAmountKeypad'
import { SendCommentEntry } from '../components/SendCommentEntry'
import { useDirectSendFlow } from '../useDirectSendFlow'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useAuth } from '@/context/authContext'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export function SendInputView() {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')
    const { isFetchingUser } = useAuth()
    const [isEditingComment, setIsEditingComment] = useState(false)
    const {
        amount,
        recipient,
        attachment,
        error,
        formattedBalance,
        balanceFillAmount,
        canProceed,
        hasSufficientBalance,
        isInsufficientBalance,
        isLoggedIn,
        isLoading,
        setAmount,
        setAttachment,
        executePayment,
    } = useDirectSendFlow()

    // handle submit - directly execute payment
    const handleSubmit = () => {
        if (canProceed && hasSufficientBalance && !isLoading) {
            executePayment()
        }
    }

    // determine button text and state
    const isButtonDisabled = !canProceed || (isLoggedIn && !hasSufficientBalance) || isLoading
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    return (
        <PageStack gap="6" className="min-h-inherit">
            <NavHeader onPrev={onBack} title={t('headers.send')} />
            {recipient && (
                <UserCard
                    type="send"
                    username={recipient.username}
                    fullName={recipient.fullName}
                    recipientType="USERNAME"
                    isVerified={recipient.isVerified}
                    avatarKey={recipient.avatarKey}
                />
            )}

            <SendAmountKeypad
                amount={amount}
                onAmountChange={setAmount}
                balance={isLoggedIn ? formattedBalance : undefined}
                balanceFillAmount={isLoggedIn ? balanceFillAmount : undefined}
                disabled={isLoading}
                commentActive={isEditingComment}
            >
                {isInsufficientBalance && <FieldError>{t('errors.insufficientPayment')}</FieldError>}
                <SendCommentEntry
                    value={attachment.message ?? ''}
                    onChange={(message) =>
                        setAttachment({ message, file: attachment.file, fileUrl: attachment.fileUrl })
                    }
                    onEditingChange={setIsEditingComment}
                />
            </SendAmountKeypad>

            <PageStack.Footer className={isEditingComment ? 'hidden' : 'gap-4'}>
                <SendWithPeanutCta
                    onClick={handleSubmit}
                    disabled={isButtonDisabled}
                    loading={isLoading}
                    insufficientBalance={isInsufficientBalance}
                />
                {error.showError && <Callout priority="error">{error.errorMessage}</Callout>}
                {!isLoggedIn && !isFetchingUser && <PaymentMethodActionList isAmountEntered={isAmountEntered} />}
                {!isLoggedIn && !isFetchingUser && <SupportCTA />}
            </PageStack.Footer>
        </PageStack>
    )
}
