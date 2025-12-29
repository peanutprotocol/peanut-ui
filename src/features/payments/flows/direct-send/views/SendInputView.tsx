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
import AmountInput from '@/components/Global/AmountInput'
import UserCard from '@/components/User/UserCard'
import FileUploadInput from '@/components/Global/FileUploadInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import SupportCTA from '@/components/Global/SupportCTA'
import { useDirectSendFlow } from '../useDirectSendFlow'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'

export function SendInputView() {
    const router = useRouter()
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

    // handle back navigation
    const handleGoBack = () => {
        if (window.history.length > 1) {
            router.back()
        } else {
            router.push('/')
        }
    }

    // determine button text and state
    const isButtonDisabled = !canProceed || (isLoggedIn && !hasSufficientBalance) || isLoading
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={handleGoBack} title="Pay" />

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
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

                {/* amount input */}
                <AmountInput
                    initialAmount={amount}
                    setPrimaryAmount={setAmount}
                    onSubmit={handleSubmit}
                    walletBalance={isLoggedIn ? formattedBalance : undefined}
                    hideBalance={!isLoggedIn}
                    hideCurrencyToggle={true}
                />

                {/* message input */}
                <FileUploadInput
                    placeholder="Comment"
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
                    {isInsufficientBalance && (
                        <ErrorAlert description="Not enough balance to fulfill this payment with Peanut" />
                    )}
                    {error.showError && <ErrorAlert description={error.errorMessage} />}
                </div>

                {/* action list for non-logged in users */}
                {!isLoggedIn && !isFetchingUser && <PaymentMethodActionList isAmountEntered={isAmountEntered} />}
            </div>

            {/* support cta for guest users */}
            {!isLoggedIn && !isFetchingUser && <SupportCTA />}
        </div>
    )
}
