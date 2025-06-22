import { useState, useEffect } from 'react'
import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycProcessing } from './states/KycProcessing'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Drawer, DrawerContent } from '../Global/Drawer'
import { KYCStatus } from '@/utils'
import { getKycDetails } from '@/app/actions/users'
import { useKycFlow } from '@/hooks/useKycFlow'
import IFrameWrapper from '../Global/IframeWrapper'

// a helper to categorize the kyc status from the user object
const getKycStatusCategory = (kycStatus: KYCStatus): 'processing' | 'completed' | 'failed' => {
    switch (kycStatus) {
        // note: not_started status is handled explicitly in KycStatusItem component
        case 'under_review':
        case 'incomplete':
            return 'processing'
        case 'approved':
            return 'completed'
        case 'rejected':
            return 'failed'
    }
    return 'processing' // fallback
}

interface KycStatusDrawerProps {
    isOpen: boolean
    onClose: () => void
    kycStatus: KYCStatus
    kycStartedAt?: string
    kycApprovedAt?: string
    kycRejectedAt?: string
}

// this component determines which kyc state to show inside the drawer and fetches rejection reasons if the kyc has failed.
export const KycStatusDrawer = ({
    isOpen,
    onClose,
    kycStatus,
    kycStartedAt,
    kycApprovedAt,
    kycRejectedAt,
}: KycStatusDrawerProps) => {
    const [rejectionReason, setRejectionReason] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const {
        handleInitiateKyc,
        iframeOptions,
        handleIframeClose,
        isLoading: isKycFlowLoading,
    } = useKycFlow({ onKycSuccess: onClose })

    const statusCategory = getKycStatusCategory(kycStatus)

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
                return <KycProcessing kycStartedAt={kycStartedAt} />
            case 'completed':
                return <KycCompleted kycApprovedAt={kycApprovedAt} />
            case 'failed':
                return <KycFailed reason={rejectionReason} kycRejectedAt={kycRejectedAt} onRetry={handleInitiateKyc} />
            default:
                return null
        }
    }

    // don't render the drawer if the kyc status is unknown or not started
    if (kycStatus === 'not_started') {
        return null
    }

    return (
        <>
            <Drawer open={isOpen} onOpenChange={onClose}>
                <DrawerContent className="p-5">{renderContent()}</DrawerContent>
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
