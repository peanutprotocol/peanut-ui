'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useModalsContext } from '@/context/ModalsContext'
import { useRouter } from 'next/navigation'

/**
 * Provider-outage screen for the Manteca add-money (onramp) and withdraw
 * (offramp) flows when `disableMantecaTransfers` is on. Mirrors the QR-pay
 * provider-outage screen (disabledPaymentProviders) — same layout and copy.
 * User-facing copy is provider-agnostic on purpose: users never see "Manteca".
 */
export function MantecaTransfersMaintenanceView({ action }: { action: 'deposits' | 'withdrawals' }) {
    const router = useRouter()
    const { setIsSupportModalOpen } = useModalsContext()
    return (
        <div className="my-auto flex h-full w-full flex-col justify-center space-y-4">
            <Card className="flex w-full flex-col items-center gap-2 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-1 p-3">
                    <Icon name="alert" size={24} />
                </div>
                <span className="text-lg font-bold">Service Temporarily Unavailable</span>
                <p className="text-center font-normal text-grey-1">
                    We're experiencing issues with {action} due to an external provider outage. We're working to restore
                    service as soon as possible.
                </p>
            </Card>
            <Button onClick={() => router.push('/home')} variant="purple" shadowSize="4">
                Go Back
            </Button>
            <button
                onClick={() => setIsSupportModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 text-sm font-medium text-grey-1 transition-colors hover:text-black"
            >
                <Icon name="peanut-support" size={16} className="text-grey-1" />
                Having trouble?
            </button>
        </div>
    )
}
