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
import { Notification } from '@/components/0_Bruddle/Notification'
import AmountInput from '@/components/Global/AmountInput'
import UserCard from '@/components/User/UserCard'
import FileUploadInput from '@/components/Global/FileUploadInput'
import SupportCTA from '@/components/Global/SupportCTA'
import { useDirectSendFlow } from '../useDirectSendFlow'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useAuth } from '@/context/authContext'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'
import { useTranslations } from 'next-intl'
import { CollateralPullNotice } from '@/components/Global/CollateralPullNotice'

export function SendInputView() {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')
    const tCommon = useTranslations('common')
    const { isFetchingUser } = useAuth()
    const {
        amount,
        recipient,
        attachment,
        error,
        formattedBalance,
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
                        isVerified={!!recipient.userId}
                    />
                )}

                {/* amount input + its field error form one column, 4px apart */}
                <div className="flex flex-col gap-1">
                    <AmountInput
                        initialAmount={amount}
                        setPrimaryAmount={setAmount}
                        onSubmit={handleSubmit}
                        walletBalance={isLoggedIn ? formattedBalance : undefined}
                        hideBalance={!isLoggedIn}
                        hideCurrencyToggle={true}
                    />
                    {isInsufficientBalance && <FieldError>{t('errors.insufficientPayment')}</FieldError>}
                    {isLoggedIn && !isInsufficientBalance && <CollateralPullNotice amountUsd={amount} />}
                </div>

                {/* message input */}
                <FileUploadInput
                    placeholder={tCommon('comment')}
                    attachmentOptions={{
                        fileUrl: attachment.fileUrl,
                        rawFile: attachment.file,
                        message: attachment.message,
                    }}
                    setAttachmentOptions={(opts) =>
                        setAttachment({
                            message: opts.message,
                            file: opts.rawFile,
                            fileUrl: opts.fileUrl,
                        })
                    }
                    className="h-11"
                />

                {/* button and error */}
                <div className="space-y-4">
                    <SendWithPeanutCta
                        onClick={handleSubmit}
                        disabled={isButtonDisabled}
                        loading={isLoading}
                        insufficientBalance={isInsufficientBalance}
                    />
                    {error.showError && <Notification priority="error">{error.errorMessage}</Notification>}
                </div>

                {/* action list for non-logged in users */}
                {!isLoggedIn && !isFetchingUser && <PaymentMethodActionList isAmountEntered={isAmountEntered} />}
            </PageStack.Center>

            {/* support cta for guest users */}
            {!isLoggedIn && !isFetchingUser && <SupportCTA />}
        </div>
    )
}
