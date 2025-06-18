import { useState, useMemo, useEffect } from 'react'
import Card, { CardPosition } from '@/components/Global/Card'
import { KycStatusDrawer } from './KycStatusDrawer'
import { useUserStore } from '@/redux/hooks'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import StatusBadge, { StatusType } from '../Global/Badges/StatusBadge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { KYCStatus, formatDate } from '@/utils'

// this component shows the current kyc status and opens a drawer with more details on click
export const KycStatusItem = ({ position = 'first' }: { position?: CardPosition }) => {
    const { user } = useUserStore()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // liveKycStatus holds the real-time status, updated via websockets
    // it falls back to the status from the user object if the websocket is not connected
    const [liveKycStatus, setLiveKycStatus] = useState<KYCStatus | undefined>(user?.user?.kycStatus as KYCStatus)

    // update the live status if the user object changes
    useEffect(() => {
        setLiveKycStatus(user?.user?.kycStatus as KYCStatus)
    }, [user?.user?.kycStatus])

    // connect to websockets for real-time updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as KYCStatus)
        },
    })

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

    if (!liveKycStatus || liveKycStatus === 'not_started') {
        return null
    }

    return (
        <>
            <Card position={position} onClick={() => setIsDrawerOpen(true)} className="cursor-pointer">
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
                onClose={() => setIsDrawerOpen(false)}
                kycStatus={liveKycStatus}
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
