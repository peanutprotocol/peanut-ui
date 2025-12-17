'use client'

// input view for send flow
// matches existing PaymentForm UI pattern

import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import FileUploadInput from '@/components/Global/FileUploadInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import SupportCTA from '@/components/Global/SupportCTA'
import { useSendFlow } from '../useSendFlow'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'

export function SendInputView() {
    const router = useRouter()
    const { user, isFetchingUser } = useAuth()
    const {
        amount,
        recipient,
        attachment,
        error,
        formattedBalance,
        canProceed,
        hasSufficientBalance,
        isLoading,
        setAmount,
        setAttachment,
        executePayment,
    } = useSendFlow()

    const isLoggedIn = !!user?.user?.userId

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
    const isInsufficientBalance = isLoggedIn && amount && !hasSufficientBalance
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
                <TokenAmountInput
                    tokenValue={amount}
                    setTokenValue={(val) => setAmount(val ?? '')}
                    onSubmit={handleSubmit}
                    walletBalance={isLoggedIn ? formattedBalance : undefined}
                    hideBalance={!isLoggedIn}
                    hideCurrencyToggle={true}
                />

                {/* message input */}
                <FileUploadInput
                    placeholder="Add reference (optional)"
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
                    <SendWithPeanutCta onClick={handleSubmit} disabled={isButtonDisabled} loading={isLoading} />
                    {isInsufficientBalance && <ErrorAlert description="Insufficient balance" />}
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
