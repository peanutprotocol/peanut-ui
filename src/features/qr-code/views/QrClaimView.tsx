'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Card } from '@/components/0_Bruddle/Card'
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
                <Card className="gap-4 p-6">
                    <div className="flex items-center justify-center">
                        {/* hero illustration — the one off-scale icon size the icon law allows */}
                        <Icon name="qr-code" size={64} />
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-heading-s">{t('claim.inviteQrTitle')}</h1>
                        <p className="text-body-m text-foreground-secondary">{t('claim.inviteQrDescription')}</p>
                    </div>
                </Card>

                {/* Important note */}
                <Callout priority="attention">
                    {t.rich('claim.permanentNote', { strong: (chunks) => <strong>{chunks}</strong> })}
                </Callout>

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

                {error && <Callout priority="error">{error}</Callout>}
            </PageStack.Center>
        </PageStack>
    )
}
