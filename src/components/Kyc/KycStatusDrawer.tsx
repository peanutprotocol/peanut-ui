import { useState, useEffect } from 'react'
import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycProcessing } from './states/KycProcessing'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Drawer, DrawerContent, DrawerTitle } from '../Global/Drawer'
import { BridgeKycStatus } from '@/utils'
import { getKycDetails } from '@/app/actions/users'
import { useKycFlow } from '@/hooks/useKycFlow'
import IFrameWrapper from '../Global/IframeWrapper'

// a helper to categorize the kyc status from the user object
const getKycStatusCategory = (bridgeKycStatus: BridgeKycStatus): 'processing' | 'completed' | 'failed' => {
    let category: 'processing' | 'completed' | 'failed'
    switch (bridgeKycStatus) {
        // note: not_started status is handled explicitly in KycStatusItem component
        case 'approved':
            category = 'completed'
            break
        case 'rejected':
            category = 'failed'
            break
        case 'under_review':
        case 'incomplete':
        default:
            category = 'processing'
            break
    }
    return category
}

interface KycStatusDrawerProps {
    isOpen: boolean
    onClose: () => void
    bridgeKycStatus: BridgeKycStatus
    bridgeKycStartedAt?: string
    bridgeKycApprovedAt?: string
    bridgeKycRejectedAt?: string
}

// this component determines which kyc state to show inside the drawer and fetches rejection reasons if the kyc has failed.
export const KycStatusDrawer = ({
    isOpen,
    onClose,
    bridgeKycStatus,
    bridgeKycStartedAt,
    bridgeKycApprovedAt,
    bridgeKycRejectedAt,
}: KycStatusDrawerProps) => {
    const [rejectionReason, setRejectionReason] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const {
        handleInitiateKyc,
        iframeOptions,
        handleIframeClose,
        isLoading: isKycFlowLoading,
    } = useKycFlow({ onKycSuccess: onClose })

    const statusCategory = getKycStatusCategory(bridgeKycStatus)

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
                return <KycProcessing bridgeKycStartedAt={bridgeKycStartedAt} />
            case 'completed':
                return <KycCompleted bridgeKycApprovedAt={bridgeKycApprovedAt} />
            case 'failed':
                return (
                    <KycFailed
                        reason={rejectionReason}
                        bridgeKycRejectedAt={bridgeKycRejectedAt}
                        onRetry={handleInitiateKyc}
                    />
                )
            default:
                return null
        }
    }

    // don't render the drawer if the kyc status is unknown or not started
    if (bridgeKycStatus === 'not_started') {
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
            <IFrameWrapper
                visible={iframeOptions.visible || isKycFlowLoading}
                src={iframeOptions.src}
                onClose={handleIframeClose}
                closeConfirmMessage={iframeOptions.closeConfirmMessage}
            />
        </>
    )
}
