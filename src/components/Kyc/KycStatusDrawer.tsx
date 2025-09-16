import { useState, useEffect } from 'react'
import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycProcessing } from './states/KycProcessing'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Drawer, DrawerContent } from '../Global/Drawer'
import { BridgeKycStatus } from '@/utils'
import { getKycDetails } from '@/app/actions/users'
import { IUserKycVerification, MantecaKycStatus } from '@/interfaces'
import { useUserStore } from '@/redux/hooks'
import { useBridgeKycFlow } from '@/hooks/useBridgeKycFlow'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { CountryData, countryData } from '@/components/AddMoney/consts'
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
    const [rejectionReason, setRejectionReason] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
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

    useEffect(() => {
        // if the drawer is open and the kyc has failed, fetch the reason
        if (isOpen && statusCategory === 'failed') {
            const fetchRejectionReason = async () => {
                setIsLoading(true)
                setRejectionReason(null)
                try {
                    // the getKycDetails endpoint returns rejection reasons if they exist
                    const response = await getKycDetails()
                    if (response.data?.reasons && response.data.reasons.length > 0) {
                        setRejectionReason(response.data.reasons[0].reason)
                    } else if (response.error) {
                        setRejectionReason(response.error)
                    } else {
                        setRejectionReason('No specific reason provided.')
                    }
                } catch (error: any) {
                    // the api service throws an error with a message on failure
                    setRejectionReason(error.message || 'Could not retrieve rejection reason.')
                } finally {
                    setIsLoading(false)
                }
            }
            fetchRejectionReason()
        }
    }, [isOpen, statusCategory])

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex h-48 items-center justify-center">
                    <PeanutLoading />
                </div>
            )
        }

        switch (statusCategory) {
            case 'processing':
                return (
                    <KycProcessing
                        bridgeKycStartedAt={user?.user.bridgeKycStartedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc}
                    />
                )
            case 'completed':
                return (
                    <KycCompleted
                        bridgeKycApprovedAt={verification?.approvedAt ?? user?.user.bridgeKycApprovedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc}
                    />
                )
            case 'failed':
                return (
                    <KycFailed
                        reason={rejectionReason}
                        bridgeKycRejectedAt={user?.user.bridgeKycRejectedAt}
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
                <DrawerContent className="p-5">{renderContent()}</DrawerContent>
            </Drawer>
            <IFrameWrapper {...bridgeIframeOptions} onClose={handleBridgeIframeClose} />
            <IFrameWrapper {...mantecaIframeOptions} onClose={handleMantecaIframeClose} />
        </>
    )
}
