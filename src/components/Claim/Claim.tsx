'use client'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { resolveClaimLink } from '@/services/sendLinks'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'
import PageContainer from '../0_Bruddle/PageContainer'
import * as _consts from './Claim.consts'
import { ClaimedView, ClaimErrorView } from './Generic'
import FlowManager from './Link/FlowManager'
import { useClaimFlow } from './useClaimFlow'
import { ClaimLoadingView } from './views/ClaimLoading.view'

export const Claim = ({}) => {
    const t = useTranslations('claim')
    const tCommon = useTranslations('common')
    const {
        user,
        isFetchingUser,
        linkState,
        setLinkState,
        isSendLinkLoading,
        failureCount,
        refetch,
        setLinkUrl,
        step,
        handleOnNext,
        handleOnPrev,
        handleOnCustom,
        claimLinkData,
        type,
        setType,
        recipient,
        setRecipient,
        tokenPrice,
        setTokenPrice,
        transactionHash,
        setTransactionHash,
        estimatedPoints,
        setEstimatedPoints,
        attachment,
        setAttachment,
        selectedRoute,
        setSelectedRoute,
        hasFetchedRoute,
        setHasFetchedRoute,
        recipientType,
        setRecipientType,
        offrampForm,
        setOfframpForm,
        userType,
        setUserType,
        userId,
        setUserId,
        initialKYCStep,
        setInitialKYCStep,
        selectedTransaction,
        showTransactionReceipt,
        isLinkCancelling,
        setisLinkCancelling,
    } = useClaimFlow()

    return (
        <PageContainer
            alignItems="center"
            className={twMerge('flex flex-col', !user && !isFetchingUser && 'min-h-[calc(100dvh_-_110px)]')}
        >
            {linkState === _consts.claimLinkStateType.LOADING && (
                <ClaimLoadingView isSendLinkLoading={isSendLinkLoading} failureCount={failureCount} />
            )}
            {linkState === _consts.claimLinkStateType.CLAIM && (
                <FlowManager
                    recipientType={recipientType}
                    step={step}
                    props={
                        {
                            onPrev: handleOnPrev,
                            onNext: handleOnNext,
                            onCustom: handleOnCustom,
                            claimLinkData,
                            type,
                            setClaimType: setType,
                            recipient,
                            setRecipient,
                            tokenPrice,
                            setTokenPrice,
                            transactionHash,
                            setTransactionHash,
                            estimatedPoints,
                            setEstimatedPoints,
                            attachment,
                            setAttachment,
                            selectedRoute,
                            setSelectedRoute,
                            hasFetchedRoute,
                            setHasFetchedRoute,
                            recipientType,
                            setRecipientType,
                            offrampForm,
                            setOfframpForm,
                            userType,
                            setUserType,
                            userId,
                            setUserId,
                            initialKYCStep,
                            setInitialKYCStep,
                        } as unknown as _consts.IClaimScreenProps
                    }
                />
            )}
            {linkState === _consts.claimLinkStateType.WRONG_PASSWORD && (
                <ClaimErrorView
                    title={t('errors.wrongPasswordTitle')}
                    message={t('errors.wrongPasswordMessage')}
                    primaryButtonText={tCommon('tryAgain')}
                    onPrimaryClick={() => {
                        setLinkState(_consts.claimLinkStateType.LOADING)
                        refetch()
                    }}
                />
            )}
            {linkState === _consts.claimLinkStateType.NOT_FOUND && (
                <ClaimErrorView
                    title={t('errors.brokenLinkTitle')}
                    message={t('errors.brokenLinkMessage')}
                    primaryButtonText={t('errors.retryLoadingLink')}
                    onPrimaryClick={() => {
                        setLinkState(_consts.claimLinkStateType.LOADING)
                        refetch()
                    }}
                />
            )}
            {/* Show this state only to guest users and receivers, never to the link creator */}
            {linkState === _consts.claimLinkStateType.ALREADY_CLAIMED &&
                selectedTransaction &&
                claimLinkData &&
                (!user || user.user.userId !== claimLinkData?.sender?.userId) && (
                    <ClaimedView amount={selectedTransaction.amount} senderUsername={claimLinkData.sender?.username} />
                )}
            {showTransactionReceipt && (
                <TransactionDetailsReceipt
                    transaction={selectedTransaction}
                    setIsLoading={setisLinkCancelling}
                    isLoading={isLinkCancelling}
                    onClose={() => setLinkUrl(resolveClaimLink(window.location.href))}
                />
            )}
        </PageContainer>
    )
}
