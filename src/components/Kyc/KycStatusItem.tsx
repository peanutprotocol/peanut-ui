import { useState, useMemo, useCallback } from 'react'
import Card, { CardPosition } from '@/components/Global/Card'
import { KycStatusDrawer } from './KycStatusDrawer'
import { useUserStore } from '@/redux/hooks'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import StatusBadge, { StatusType } from '../Global/Badges/StatusBadge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { BridgeKycStatus, formatDate } from '@/utils'
import { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

// this component shows the current kyc status and opens a drawer with more details on click
export const KycStatusItem = ({
    position = 'first',
    className,
}: {
    position?: CardPosition
    className?: HTMLAttributes<HTMLDivElement>['className']
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

    const birdgeKycStatus = wsBridgeKycStatus || user?.user?.bridgeKycStatus

    const subtitle = useMemo(() => {
        const bridgeKycStartedAt = user?.user?.bridgeKycStartedAt
        if (!bridgeKycStartedAt) {
            return 'Verification in progress'
        }
        try {
            return `Submitted on ${formatDate(new Date(bridgeKycStartedAt)).split(' - ')[0]}`
        } catch (error) {
            console.error('Failed to parse bridgeKycStartedAt date:', error)
            return 'Verification in progress'
        }
    }, [user?.user?.bridgeKycStartedAt])

    if (!birdgeKycStatus || birdgeKycStatus === 'not_started') {
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
                <div className="flex items-center gap-4">
                    <KYCStatusIcon />
                    <div className="flex-1">
                        <p className="font-semibold">Identity verification</p>
                        <p className="text-sm text-grey-1">{subtitle}</p>
                    </div>
                </div>
            </Card>

            <KycStatusDrawer
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                bridgeKycStatus={birdgeKycStatus}
                bridgeKycStartedAt={user?.user?.bridgeKycStartedAt}
                bridgeKycApprovedAt={user?.user?.bridgeKycApprovedAt}
                bridgeKycRejectedAt={user?.user?.bridgeKycRejectedAt}
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
