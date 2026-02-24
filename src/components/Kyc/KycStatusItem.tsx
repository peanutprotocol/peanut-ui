import { useState, useMemo, useCallback } from 'react'
import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { KycStatusDrawer } from './KycStatusDrawer'
import { useUserStore } from '@/redux/hooks'
import { useWebSocket } from '@/hooks/useWebSocket'
import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { type IUserKycVerification } from '@/interfaces'
import StatusPill from '../Global/StatusPill'
import { KYCStatusIcon } from './KYCStatusIcon'
import {
    isKycStatusApproved,
    isKycStatusPending,
    isKycStatusFailed,
    isKycStatusNotStarted,
    isKycStatusActionRequired,
} from '@/constants/kyc.consts'

// this component shows the current kyc status and opens a drawer with more details on click
export const KycStatusItem = ({
    position = 'first',
    className,
    verification,
    bridgeKycStatus,
    bridgeKycStartedAt,
}: {
    position?: CardPosition
    className?: HTMLAttributes<HTMLDivElement>['className']
    verification?: IUserKycVerification
    bridgeKycStatus?: BridgeKycStatus
    bridgeKycStartedAt?: string
}) => {
    const { user } = useUserStore()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [wsBridgeKycStatus, setWsBridgeKycStatus] = useState<BridgeKycStatus | undefined>(undefined)

    const handleCloseDrawer = useCallback(() => {
        setIsDrawerOpen(false)
    }, [])

    // connect to websockets for real-time updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onKycStatusUpdate: (newStatus) => {
            setWsBridgeKycStatus(newStatus as BridgeKycStatus)
        },
    })

    const finalBridgeKycStatus = wsBridgeKycStatus || bridgeKycStatus || user?.user?.bridgeKycStatus
    const kycStatus = verification ? verification.status : finalBridgeKycStatus

    const isApproved = isKycStatusApproved(kycStatus)
    const isPending = isKycStatusPending(kycStatus)
    const isRejected = isKycStatusFailed(kycStatus)
    const isActionRequired = isKycStatusActionRequired(kycStatus)
    // if a verification record exists with NOT_STARTED, the user has initiated KYC
    // (backend creates the record on initiation). only hide for bridge's default state.
    const isInitiatedButNotStarted = !!verification && isKycStatusNotStarted(kycStatus)

    const subtitle = useMemo(() => {
        if (isInitiatedButNotStarted) return 'In progress'
        if (isActionRequired) return 'Action needed'
        if (isPending) return 'Under review'
        if (isApproved) return 'Approved'
        if (isRejected) return 'Rejected'
        return 'Unknown'
    }, [isInitiatedButNotStarted, isActionRequired, isPending, isApproved, isRejected])

    // only hide for bridge's default "not_started" state.
    // if a verification record exists, the user has initiated KYC — show it.
    if (!verification && isKycStatusNotStarted(kycStatus)) {
        return null
    }

    return (
        <>
            <Card
                position={position}
                onClick={() => {
                    setIsDrawerOpen(true)
                }}
                className={twMerge('cursor-pointer', className)}
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <KYCStatusIcon />
                        <div className="flex-1">
                            <p className="font-semibold">Identity verification</p>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-grey-1">{subtitle}</p>
                                <StatusPill
                                    status={
                                        isInitiatedButNotStarted || isActionRequired || isPending
                                            ? 'pending'
                                            : isRejected
                                              ? 'cancelled'
                                              : 'completed'
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {isDrawerOpen && (
                <KycStatusDrawer
                    isOpen={isDrawerOpen}
                    onClose={handleCloseDrawer}
                    verification={verification}
                    bridgeKycStatus={finalBridgeKycStatus}
                />
            )}
        </>
    )
}
