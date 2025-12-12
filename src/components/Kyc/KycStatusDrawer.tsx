import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycProcessing } from './states/KycProcessing'
import { Drawer, DrawerContent, DrawerTitle } from '../Global/Drawer'
import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { type IUserKycVerification, MantecaKycStatus } from '@/interfaces'
import { useUserStore } from '@/redux/hooks'
import { useBridgeKycFlow } from '@/hooks/useBridgeKycFlow'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import IFrameWrapper from '@/components/Global/IframeWrapper'

// a helper to categorize the kyc status from the user object
const getKycStatusCategory = (status: BridgeKycStatus | MantecaKycStatus): 'processing' | 'completed' | 'failed' => {
    switch (status) {
        case 'approved':
        case MantecaKycStatus.ACTIVE:
            return 'completed'
        case 'rejected':
        case MantecaKycStatus.INACTIVE:
            return 'failed'
        case 'under_review':
        case 'incomplete':
        case MantecaKycStatus.ONBOARDING:
        default:
            return 'processing'
    }
}

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

    const onRetry = async () => {
        if (provider === 'MANTECA') {
            await openMantecaKyc(country as CountryData)
        } else {
            await initiateBridgeKyc()
        }
    }

    const isLoadingKyc = isBridgeLoading || isMantecaLoading

    const renderContent = () => {
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
            case 'failed':
                return (
                    <KycFailed
                        reason={user?.user?.bridgeKycRejectionReasonString ?? ''}
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

    // don't render the drawer if the kyc status is unknown or not started
    if (status === 'not_started' || !status) {
        return null
    }

    return (
        <>
            <Drawer open={isOpen} onOpenChange={onClose}>
                <DrawerContent className="p-5 pb-12">
                    <DrawerTitle className="sr-only">KYC Status</DrawerTitle>
                    {renderContent()}
                </DrawerContent>
            </Drawer>
            <IFrameWrapper {...bridgeIframeOptions} onClose={handleBridgeIframeClose} />
            <IFrameWrapper {...mantecaIframeOptions} onClose={handleMantecaIframeClose} />
        </>
    )
}
