'use client'

import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Card from '@/components/Global/Card'
import { HoldToClaimButton } from '@/components/Global/HoldToClaimButton'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import type { ShakeIntensity } from '@/hooks/useHoldToClaim'
import { useTranslations } from 'next-intl'

interface QrClaimViewProps {
    shakeClass: string
    isLoading: boolean
    error: string | null
    onClaim: () => Promise<void>
    onShakeChange: (on: boolean, intensity: ShakeIntensity) => void
}

export function QrClaimView({ shakeClass, isLoading, error, onClaim, onShakeChange }: QrClaimViewProps) {
    const t = useTranslations('qrPay')

    return (
        <PageStack className={shakeClass}>
            <NavHeader title={t('claim.inviteQrTitle')} />
            <PageStack.Center className="gap-4">
                {/* QR Code Visual */}
                <Card className="space-y-4 p-6">
                    <div className="flex items-center justify-center">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full">
                            <Icon name="qr-code" size={64} />
                        </div>
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-heading-s">{t('claim.inviteQrTitle')}</h1>
                        <p className="text-body-m text-foreground-secondary">{t('claim.inviteQrDescription')}</p>
                    </div>
                </Card>

                {/* Important note */}
                <Card className="border-2 border-action-secondary bg-action-secondary/10 p-4">
                    <div className="flex gap-3">
                        <p className="text-body-s">
                            {t.rich('claim.permanentNote', { strong: (chunks) => <strong>{chunks}</strong> })}
                        </p>
                    </div>
                </Card>

                {/* Claim button — DRY with /card eligibility-check via
                    <HoldToClaimButton />. */}
                <HoldToClaimButton
                    onComplete={onClaim}
                    disabled={isLoading}
                    loading={isLoading}
                    onShakeChange={onShakeChange}
                >
                    {isLoading ? t('claim.claiming') : t('claim.holdToClaim')}
                </HoldToClaimButton>

                {error && <Notification priority="error">{error}</Notification>}
            </PageStack.Center>
        </PageStack>
    )
}
