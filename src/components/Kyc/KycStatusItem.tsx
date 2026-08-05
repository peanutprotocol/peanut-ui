import { useState, useMemo, useCallback } from 'react'
import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { KycStatusDrawer } from './KycStatusDrawer'
import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import StatusPill from '../Global/StatusPill'
import { KYCStatusIcon } from './KYCStatusIcon'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useTranslations } from 'next-intl'

// kyc history entry type + type guard — a marker the timeline injects so the
// identity-verification row renders inline. Status is read from
// useIdentityVerification() inside the component, so the entry carries no status.
export interface KycHistoryEntry {
    isKyc: true
    uuid: string
    timestamp: string
}

export const isKycStatusItem = (entry: object): entry is KycHistoryEntry => {
    return 'isKyc' in entry && entry.isKyc === true
}

// this component shows the current identity-verification status and opens a
// drawer with more details on click. Status is sourced from the provider-agnostic
// identityVerification read-model — no provider names, no props for status.
export const KycStatusItem = ({
    position = 'first',
    className,
}: {
    position?: CardPosition
    className?: HTMLAttributes<HTMLDivElement>['className']
}) => {
    const t = useTranslations('kyc')
    const { status } = useIdentityVerification()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    // keep drawer component mounted when SDK flow is active (so SumsubKycModals persists
    // even after the drawer visually closes)
    const [keepDrawerMounted, setKeepDrawerMounted] = useState(false)

    const handleCloseDrawer = useCallback(() => {
        setIsDrawerOpen(false)
    }, [])

    const subtitle = useMemo(() => {
        switch (status) {
            case 'processing':
                return t('statusProcessing')
            case 'verified':
                return t('verified')
            case 'action_required':
                return t('actionNeeded')
            case 'failed':
                return t('statusFailed')
            default:
                return t('statusUnknown')
        }
    }, [status, t])

    // not_started ⇒ hide the card entirely.
    if (status === 'not_started') {
        return null
    }

    const pill = status === 'verified' ? 'completed' : status === 'failed' ? 'cancelled' : 'pending'

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
                            <p className="font-semibold">{t('identityVerification')}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-grey-1">{subtitle}</p>
                                <StatusPill status={pill} />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {(isDrawerOpen || keepDrawerMounted) && (
                <KycStatusDrawer
                    isOpen={isDrawerOpen}
                    onClose={handleCloseDrawer}
                    onKeepMounted={setKeepDrawerMounted}
                />
            )}
        </>
    )
}
