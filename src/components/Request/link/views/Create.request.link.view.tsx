'use client'
import FileUploadInput from '@/components/Global/FileUploadInput'
import NavHeader from '@/components/Global/NavHeader'
import Link from 'next/link'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import AmountInput from '@/components/Global/AmountInput'
import { useTranslations } from 'next-intl'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useSafeBack } from '@/hooks/useSafeBack'
import { CreateRequestLinkCta } from './CreateRequestLinkCta'
import { useCreateRequestLink } from './useCreateRequestLink'

export const CreateRequestLinkView = () => {
    const t = useTranslations('request')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const onBack = useSafeBack('/home')
    const {
        tokenValue,
        attachmentOptions,
        errorState,
        generatedLink,
        requestId,
        isCreatingLink,
        isUpdatingRequest,
        peanutWalletBalance,
        qrCodeLink,
        handleTokenValueChange,
        handleAttachmentOptionsChange,
        handleTokenAmountSubmit,
        generateLink,
    } = useCreateRequestLink()

    return (
        <div className="flex min-h-inherit w-full flex-col justify-start gap-8">
            <NavHeader onPrev={onBack} title={tNav('request')} />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                {/* board order (17831:78719): card, amount, helper note, qr, message, cta */}
                <PeanutActionCard type="request" />

                <AmountInput
                    className="w-full"
                    initialAmount={tokenValue}
                    setPrimaryAmount={handleTokenValueChange}
                    onSubmit={handleTokenAmountSubmit}
                    walletBalance={peanutWalletBalance}
                    disabled={!!requestId}
                />

                {/* only meaningful while the amount is empty (coderabbit #2780) */}
                {(!tokenValue || Number(tokenValue) === 0) && (
                    <Notification priority="helper">{t('leaveEmptyHint')}</Notification>
                )}

                {/* Before a request exists the QR already encodes the profile
                    payment link for the entered amount, so it only stays
                    blurred while there's neither a request nor an amount. */}
                <QRCodeWrapper
                    isBlurred={!requestId && !(parseFloat(tokenValue) > 0)}
                    url={qrCodeLink}
                    isLoading={isCreatingLink || isUpdatingRequest}
                />

                <FileUploadInput
                    className="h-11"
                    placeholder={tCommon('comment')}
                    attachmentOptions={attachmentOptions}
                    setAttachmentOptions={handleAttachmentOptionsChange}
                />

                <CreateRequestLinkCta
                    requestId={requestId}
                    generatedLink={generatedLink}
                    isCreatingLink={isCreatingLink}
                    isUpdatingRequest={isUpdatingRequest}
                    tokenValue={tokenValue}
                    onGenerate={generateLink}
                />

                {/*
                    The other way to be paid. A request asks one person for one
                    amount and is answered inside Peanut; standing bank details
                    take any amount from anybody through their own bank. Both
                    are money coming in, so the screen for one names the other
                    rather than leaving the user to find it under Add.
                */}
                <Link
                    href="/get-paid"
                    className="text-center text-body-s text-foreground-secondary underline underline-offset-4"
                >
                    {t('bankDetailsAlternative')}
                </Link>

                {errorState.showError && (
                    <div className="text-start">
                        <label className="text-body-s font-normal text-foreground-error">
                            {errorState.errorMessage}
                        </label>
                    </div>
                )}
            </div>
        </div>
    )
}
