'use client'

import GeneralRecipientInput from '@/components/Global/GeneralRecipientInput'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { formatTokenAmount } from '@/utils/general.utils'
import { formatUnits } from 'viem'
import { type IClaimScreenProps } from '../Claim.consts'
import SendLinkActionList from '@/components/Claim/Link/SendLinkActionList'
import { ClaimBankFlowStep } from '@/context/ClaimBankFlowContext'
import { BankFlowManager } from './views/BankFlowManager.view'
import { ClaimAddressConfirmationModal } from './views/ClaimAddressConfirmationModal.view'
import { Button } from '@/components/0_Bruddle/Button'
import Image from 'next/image'
import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import { GuestVerificationModal } from '@/components/Global/GuestVerificationModal'
import MantecaFlowManager from './MantecaFlowManager'
import { useInitialClaimFlow } from './useInitialClaimFlow'
import { badgeCampaignForLegacyWire } from '@/components/Invites/badge-campaign-context'
import { useSearchParams } from 'next/navigation'

export const InitialClaimLinkView = (props: IClaimScreenProps) => {
    // `/claim` remains a published singular campaignTag wire. resolved here from
    // the live search params (this file predates the nuqs ratchet) so url order
    // and duplicate keys keep their original precedence, then handed to the hook.
    const searchParams = useSearchParams()
    const campaignTag = badgeCampaignForLegacyWire(searchParams)
    const {
        onNext,
        claimLinkData,
        setRecipient,
        recipient,
        tokenPrice,
        attachment,
        selectedRoute,
        hasFetchedRoute,
        recipientType,
    } = props
    const {
        t,
        tCommon,
        tNav,
        senderDisplay,
        errorState,
        fieldError,
        isValidRecipient,
        isXchainLoading,
        inputChanging,
        showConfirmationModal,
        setShowConfirmationModal,
        claimBankFlowStep,
        claimToExternalWallet,
        setClaimToExternalWallet,
        claimToMercadoPago,
        hideTokenSelector,
        showVerificationModal,
        setShowVerificationModal,
        verificationPromptReason,
        removeParamStep,
        isLoading,
        isXChain,
        isPeanutWallet,
        user,
        router,
        isReward,
        isDevconnectClaimFlow,
        handleClaimLink,
        handleClaimAction,
        handleRecipientUpdate,
    } = useInitialClaimFlow(props, campaignTag)

    const getButtonText = () => {
        if (isPeanutWallet && !claimToExternalWallet) {
            return (
                <div className="flex items-center gap-1">
                    <div>{t('initial.receiveOn')} </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN} alt={tNav('peanutLogoAlt')} className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt={tNav('peanutLogoAlt')} />
                    </div>
                </div>
            )
        }

        if (selectedRoute) {
            return t('review')
        }

        if ((isLoading || isXchainLoading) && !inputChanging) {
            return t('receiving')
        }

        if (isXChain && hasFetchedRoute && !selectedRoute) {
            return tCommon('retry')
        }

        return t('receiveNow')
    }

    if (claimBankFlowStep) {
        return <BankFlowManager {...props} />
    }

    if (claimToMercadoPago && !!user) {
        return (
            <MantecaFlowManager
                claimLinkData={claimLinkData}
                attachment={attachment}
                amount={
                    isReward
                        ? formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!
                        : (formatTokenAmount(
                              Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * tokenPrice
                          ) ?? '')
                }
            />
        )
    }

    return (
        <div className="flex min-h-inherit flex-col justify-between gap-8 md:min-h-fit">
            {!!user?.user.userId || claimBankFlowStep || claimToExternalWallet ? (
                <div>
                    <NavHeader
                        title={t('receive')}
                        onPrev={() => {
                            if (claimToExternalWallet) {
                                setClaimToExternalWallet(false)
                            } else {
                                router.push('/home')
                            }
                        }}
                    />
                </div>
            ) : (
                <div className="-mt-1 md:hidden">
                    <div className="pb-1 text-center text-heading-s">{t('receive')}</div>
                </div>
            )}
            <PageStack.Center className="gap-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={senderDisplay.displayName}
                    amount={
                        isReward
                            ? formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!
                            : (formatTokenAmount(
                                  Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * tokenPrice
                              ) ?? '')
                    }
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={attachment.message}
                    fileUrl={attachment.attachmentUrl}
                />
                {errorState.showError && <Notification priority="error">{errorState.errorMessage}</Notification>}

                {/* Token Selector
                 * We don't want to show this if we're claiming to peanut wallet. Else its okay
                 */}
                {!hideTokenSelector &&
                    recipientType !== 'iban' &&
                    recipientType !== 'us' &&
                    claimBankFlowStep !== ClaimBankFlowStep.BankCountryList &&
                    !!claimToExternalWallet && (
                        <TokenSelector viewType="claim" disabled={recipientType === 'username'} />
                    )}

                <div className="space-y-2">
                    {/* Alternative options section with divider */}
                    {/* Manual Input Section - Always visible in non-peanut-only mode */}
                    {!!claimToExternalWallet && (
                        <FieldColumn error={fieldError}>
                            <GeneralRecipientInput
                                placeholder={t('initial.recipientPlaceholder')}
                                recipient={recipient}
                                onUpdate={handleRecipientUpdate}
                                showInfoText={false}
                            />
                        </FieldColumn>
                    )}
                    {recipientType === 'username' && !!claimToExternalWallet && (
                        <div className="text-body-xs text-foreground-secondary">{t('initial.usdcArbitrumOnly')}</div>
                    )}
                </div>

                <div className="space-y-2">
                    {!!(claimToExternalWallet || !!user?.user.userId) && (
                        <Button
                            icon={'arrow-down'}
                            shadowSize="4"
                            onClick={handleClaimAction}
                            loading={isLoading || isXchainLoading}
                            disabled={
                                isLoading ||
                                isXchainLoading ||
                                inputChanging ||
                                !isValidRecipient ||
                                (isXChain && !selectedRoute && (!hasFetchedRoute || isXchainLoading))
                            }
                            className="text-body-s md:text-body-m"
                        >
                            {getButtonText()}
                        </Button>
                    )}
                    {!claimToExternalWallet && (
                        <SendLinkActionList
                            claimLinkData={claimLinkData}
                            isLoggedIn={!!user?.user.userId}
                            isInviteLink
                            setExternalWalletRecipient={setRecipient}
                            showDevconnectMethod={isDevconnectClaimFlow}
                        />
                    )}
                </div>
            </PageStack.Center>
            <ClaimAddressConfirmationModal
                showConfirmationModal={showConfirmationModal}
                setShowConfirmationModal={setShowConfirmationModal}
                isXChain={isXChain}
                onNext={onNext}
                handleClaimLink={handleClaimLink}
                setClaimToExternalWallet={setClaimToExternalWallet}
            />
            <GuestVerificationModal
                redirectToVerification
                secondaryCtaLabel={t('guestVerification.otherMethod')}
                isOpen={showVerificationModal}
                onClose={() => {
                    removeParamStep()
                    setShowVerificationModal(false)
                }}
                description={
                    verificationPromptReason === 'sender-unverified'
                        ? t('guestVerification.senderUnverifiedDescription')
                        : t('guestVerification.accountRequiredDescription')
                }
                inviterUsername={claimLinkData?.sender?.username}
            />
        </div>
    )
}
