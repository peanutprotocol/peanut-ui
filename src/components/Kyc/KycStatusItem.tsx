import { useState, useMemo, useCallback } from 'react'
import Card, { CardPosition } from '@/components/Global/Card'
import { KycStatusDrawer } from './KycStatusDrawer'
import { useUserStore } from '@/redux/hooks'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import StatusBadge, { StatusType } from '../Global/Badges/StatusBadge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { KYCStatus, formatDate } from '@/utils'
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
    const [wsKycStatus, setWsKycStatus] = useState<KYCStatus | undefined>(undefined)

    const handleCloseDrawer = useCallback(() => {
        setIsDrawerOpen(false)
    }, [])

    // connect to websockets for real-time updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onKycStatusUpdate: (newStatus) => {
            setWsKycStatus(newStatus as KYCStatus)
        },
    })

    const kycStatus = wsKycStatus || user?.user?.kycStatus

    const subtitle = useMemo(() => {
        const kycStartedAt = user?.user?.kycStartedAt
        if (!kycStartedAt) {
            return 'Verification in progress'
        }
        try {
            return `Submitted on ${formatDate(new Date(kycStartedAt)).split(' - ')[0]}`
        } catch (error) {
            console.error('Failed to parse kycStartedAt date:', error)
            return 'Verification in progress'
        }
    }, [user?.user?.kycStartedAt])

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
                kycStatus={kycStatus}
                kycStartedAt={user?.user?.kycStartedAt}
                kycApprovedAt={user?.user?.kycApprovedAt}
                kycRejectedAt={user?.user?.kycRejectedAt}
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
