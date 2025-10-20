import { useState, useMemo, useCallback } from 'react'
import Card, { type CardPosition } from '@/components/Global/Card'
import { KycStatusDrawer } from './KycStatusDrawer'
import { useUserStore } from '@/redux/hooks'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import StatusBadge, { type StatusType } from '../Global/Badges/StatusBadge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { type BridgeKycStatus, formatDate } from '@/utils'
import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { type IUserKycVerification } from '@/interfaces'
import Image from 'next/image'
import { STAR_STRAIGHT_ICON } from '@/assets'

// @dev TODO: Remove hardcoded KYC points - implement proper solution
// Current approach is suboptimal - KYC should be a real history entry from backend.
// Proper fix:
// 1. Add KYC_VERIFICATION to EHistoryEntryType enum
// 2. Create history entry when KYC completes (in handleBridgeKycApproval/handleMantecaKycApproval)
// 3. Include KYC entries in /users/history endpoint response
// 4. Remove frontend KycHistoryEntry injection and this hardcoded value
// 5. Display KYC as a normal activity item with points from backend
// Benefits: Single source of truth, no hardcoding, consistent with other activities
const KYC_BONUS_POINTS = 2000

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

    const subtitle = useMemo(() => {
        const date = verification
            ? (verification.approvedAt ?? verification.updatedAt ?? verification.createdAt)
            : bridgeKycStartedAt
        if (!date) {
            return 'Verification in progress'
        }
        try {
            return `Submitted on ${formatDate(new Date(date)).split(' - ')[0]}`
        } catch (error) {
            console.error('Failed to parse date:', error)
            return 'Verification in progress'
        }
    }, [bridgeKycStartedAt, verification])

    // Check if KYC is approved to show points earned
    const isApproved = kycStatus === 'approved' || kycStatus === 'ACTIVE'

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
                            <p className="text-sm text-grey-1">{subtitle}</p>
                        </div>
                    </div>
                    {isApproved && (
                        <div className="flex items-center gap-1 text-sm font-semibold text-grey-1">
                            <Image src={STAR_STRAIGHT_ICON} alt="star" width={16} height={16} />
                            <span>+{KYC_BONUS_POINTS}</span>
                        </div>
                    )}
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
    return <AvatarWithBadge icon="user-id" className="bg-yellow-1" size="small" />
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
