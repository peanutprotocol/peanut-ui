import { KycActionRequired } from './states/KycActionRequired'
import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycProcessing } from './states/KycProcessing'
import { KycRequiresDocuments } from './states/KycRequiresDocuments'
import { Drawer, DrawerContent, DrawerTitle } from '../Global/Drawer'
import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { type IUserKycVerification } from '@/interfaces'
import { useUserStore } from '@/redux/hooks'
import { useBridgeKycFlow } from '@/hooks/useBridgeKycFlow'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import IFrameWrapper from '@/components/Global/IframeWrapper'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { getKycStatusCategory, isKycStatusNotStarted } from '@/constants/kyc.consts'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

interface KycStatusDrawerProps {
    isOpen: boolean
    onClose: () => void
    verification?: IUserKycVerification
    bridgeKycStatus?: BridgeKycStatus
}

// this component determines which kyc state to show inside the drawer and fetches rejection reasons if the kyc has failed.
export const KycStatusDrawer = ({ isOpen, onClose, verification, bridgeKycStatus }: KycStatusDrawerProps) => {
    const { user } = useUserStore()

    const status = verification ? verification.status : bridgeKycStatus
    const statusCategory = status ? getKycStatusCategory(status) : undefined
    const countryCode = verification ? verification.mantecaGeo || verification.bridgeGeo : null
    const isBridgeKyc = !verification && !!bridgeKycStatus
    const provider = verification ? verification.provider : 'BRIDGE'
    // derive region intent from sumsub verification metadata so token uses correct level
    const sumsubRegionIntent = (
        verification?.provider === 'SUMSUB' ? verification?.metadata?.regionIntent : undefined
    ) as KYCRegionIntent | undefined

    const {
        handleInitiateKyc: initiateBridgeKyc,
        iframeOptions: bridgeIframeOptions,
        handleIframeClose: handleBridgeIframeClose,
        isLoading: isBridgeLoading,
    } = useBridgeKycFlow({ onKycSuccess: onClose, onManualClose: onClose })

    const country = countryCode ? countryData.find((c) => c.id.toUpperCase() === countryCode.toUpperCase()) : undefined

    const {
        openMantecaKyc,
        iframeOptions: mantecaIframeOptions,
        handleIframeClose: handleMantecaIframeClose,
        isLoading: isMantecaLoading,
    } = useMantecaKycFlow({
        onSuccess: onClose,
        onClose: onClose,
        onManualClose: onClose,
        country: country as CountryData,
    })

    const {
        handleInitiateKyc: initiateSumsub,
        showWrapper: showSumsubWrapper,
        accessToken: sumsubAccessToken,
        handleSdkComplete: handleSumsubComplete,
        handleClose: handleSumsubClose,
        refreshToken: sumsubRefreshToken,
        isLoading: isSumsubLoading,
        isVerificationProgressModalOpen: isSumsubProgressModalOpen,
        closeVerificationProgressModal: closeSumsubProgressModal,
        error: sumsubError,
    } = useSumsubKycFlow({ onKycSuccess: onClose, onManualClose: onClose, regionIntent: sumsubRegionIntent })

    const onRetry = async () => {
        if (provider === 'SUMSUB') {
            await initiateSumsub()
        } else if (provider === 'MANTECA') {
            await openMantecaKyc(country as CountryData)
        } else {
            await initiateBridgeKyc()
        }
    }

    const isLoadingKyc = isBridgeLoading || isMantecaLoading || isSumsubLoading

    // check if any bridge rail needs additional documents
    const bridgeRailsNeedingDocs = (user?.rails ?? []).filter(
        (r) => r.status === 'REQUIRES_EXTRA_INFORMATION' && r.rail.provider.code === 'BRIDGE'
    )
    const additionalRequirements: string[] =
        bridgeRailsNeedingDocs.length > 0
            ? ((bridgeRailsNeedingDocs[0].metadata?.additionalRequirements as string[]) ?? [])
            : []
    const needsAdditionalDocs = additionalRequirements.length > 0

    // count sumsub rejections for failure lockout.
    // counts total REJECTED entries — accurate if backend creates a new row per attempt.
    // if backend updates in-place (single row), this will be 0 or 1 and the lockout
    // won't trigger from count alone (terminal labels and rejectType still work).
    const sumsubFailureCount =
        user?.user?.kycVerifications?.filter((v) => v.provider === 'SUMSUB' && v.status === 'REJECTED').length ?? 0

    const handleSubmitAdditionalDocs = async () => {
        await initiateSumsub(undefined, 'peanut-additional-docs')
    }

    const renderContent = () => {
        // bridge additional document requirement takes priority over verification status
        if (needsAdditionalDocs) {
            return (
                <KycRequiresDocuments
                    requirements={additionalRequirements}
                    onSubmitDocuments={handleSubmitAdditionalDocs}
                    isLoading={isLoadingKyc}
                />
            )
        }

        switch (statusCategory) {
            case 'processing':
                return (
                    <KycProcessing
                        bridgeKycStartedAt={verification?.createdAt ?? user?.user?.bridgeKycStartedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc}
                    />
                )
            case 'completed':
                return (
                    <KycCompleted
                        bridgeKycApprovedAt={verification?.approvedAt ?? user?.user?.bridgeKycApprovedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc}
                    />
                )
            case 'action_required':
                return (
                    <KycActionRequired
                        onResume={onRetry}
                        isLoading={isLoadingKyc}
                        rejectLabels={verification?.rejectLabels}
                    />
                )
            case 'failed':
                return (
                    <KycFailed
                        rejectLabels={verification?.rejectLabels}
                        bridgeReason={user?.user?.bridgeKycRejectionReasonString}
                        isSumsub={provider === 'SUMSUB'}
                        rejectType={verification?.rejectType}
                        failureCount={sumsubFailureCount}
                        bridgeKycRejectedAt={verification?.updatedAt ?? user?.user?.bridgeKycRejectedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc}
                        onRetry={onRetry}
                        isLoading={isLoadingKyc}
                    />
                )
            default:
                return null
        }
    }

    // don't render the drawer if the kyc status is unknown or not started.
    // if a verification record exists, the user has initiated KYC — show the drawer.
    if (!verification && isKycStatusNotStarted(status)) {
        return null
    }

    return (
        <>
            <Drawer open={isOpen} onOpenChange={onClose}>
                <DrawerContent className="p-5 pb-12">
                    <DrawerTitle className="sr-only">KYC Status</DrawerTitle>
                    {renderContent()}
                    {sumsubError && provider === 'SUMSUB' && (
                        <p className="text-red-500 mt-3 text-center text-sm">{sumsubError}</p>
                    )}
                </DrawerContent>
            </Drawer>
            <IFrameWrapper {...bridgeIframeOptions} onClose={handleBridgeIframeClose} />
            <IFrameWrapper {...mantecaIframeOptions} onClose={handleMantecaIframeClose} />
            <SumsubKycWrapper
                visible={showSumsubWrapper}
                accessToken={sumsubAccessToken}
                onClose={handleSumsubClose}
                onComplete={handleSumsubComplete}
                onRefreshToken={sumsubRefreshToken}
                autoStart
            />
            <KycVerificationInProgressModal isOpen={isSumsubProgressModalOpen} onClose={closeSumsubProgressModal} />
        </>
    )
}
