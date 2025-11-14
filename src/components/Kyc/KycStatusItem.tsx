import { useState, useMemo, useCallback } from 'react'
import Card, { type CardPosition } from '@/components/Global/Card'
import { KycStatusDrawer } from './KycStatusDrawer'
import { useUserStore } from '@/redux/hooks'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import StatusBadge, { type StatusType } from '../Global/Badges/StatusBadge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { type BridgeKycStatus } from '@/utils'
import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { type IUserKycVerification } from '@/interfaces'
import StatusPill from '../Global/StatusPill'

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

    // Check if KYC is approved to show points earned
    const isApproved = kycStatus === 'approved' || kycStatus === 'ACTIVE'

    const isPending = kycStatus === 'under_review' || kycStatus === 'incomplete' || kycStatus === 'ONBOARDING'
    const isRejected = kycStatus === 'rejected' || kycStatus === 'INACTIVE'

    const subtitle = useMemo(() => {
        if (isPending) {
            return 'Under review'
        }
        if (isApproved) {
            return 'Approved'
        }
        return 'Rejected'
    }, [isPending, isApproved, isRejected])

    if (!kycStatus || kycStatus === 'not_started') {
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
                                <StatusPill status={isPending ? 'pending' : isRejected ? 'cancelled' : 'completed'} />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <KycStatusDrawer
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                verification={verification}
                bridgeKycStatus={finalBridgeKycStatus}
            />
        </>
    )
}

export const KYCStatusIcon = () => {
    return <AvatarWithBadge icon="user-id" className="bg-yellow-1" size="extra-small" />
}

export const KYCStatusDrawerItem = ({ status }: { status: StatusType }) => {
    return (
        <Card position="single" className="flex items-center gap-4">
            <KYCStatusIcon />
            <div className="flex flex-col gap-2">
                <h3 className="text-lg font-extrabold">Identity verification</h3>
                <StatusBadge status={status} className="w-fit" size="small" />
            </div>
        </Card>
    )
}
