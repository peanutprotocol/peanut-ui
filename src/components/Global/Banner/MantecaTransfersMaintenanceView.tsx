'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

/**
 * Provider-outage screen for the Manteca add-money (onramp) and withdraw
 * (offramp) flows when `disableMantecaTransfers` is on. Mirrors the QR-pay
 * provider-outage screen (disabledPaymentProviders) — same layout and copy.
 * User-facing copy is provider-agnostic on purpose: users never see "Manteca".
 */
export function MantecaTransfersMaintenanceView({ action }: { action: 'deposits' | 'withdrawals' }) {
    const t = useTranslations('global')
    const router = useRouter()
    const { setIsSupportModalOpen } = useModalsContext()
    return (
        <div className="my-auto space-y-4 flex h-full w-full flex-col justify-center">
            <Card className="flex w-full flex-col items-center gap-2 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                    <Icon name="alert" size={24} />
                </div>
                <span className="text-heading-card">{t('mantecaMaintenance.title')}</span>
                <p className="text-center font-normal text-foreground-secondary">
                    {t('mantecaMaintenance.description', { action })}
                </p>
            </Card>
            <Button onClick={() => router.push('/home')} variant="purple" shadowSize="4">
                {t('mantecaMaintenance.goBack')}
            </Button>
            <button
                onClick={() => setIsSupportModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary transition-colors hover:text-black"
            >
                <Icon name="peanut-support" size={16} className="text-foreground-secondary" />
                {t('mantecaMaintenance.havingTrouble')}
            </button>
        </div>
    )
}
