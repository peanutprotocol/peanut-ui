'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import NavHeader from '@/components/Global/NavHeader'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { useBridgeHostedVerification } from '@/hooks/useBridgeHostedVerification'
import { useSafeBack } from '@/hooks/useSafeBack'

/**
 * "What to expect" screen in front of Bridge's hosted verification (Persona).
 * The tap used to hand the user straight to the vendor, which is the one flow
 * where that hurts: it runs at the vendor — the in-app browser sheet on
 * native, a new tab on web — and keeps no partial progress, so anyone who
 * leaves mid-way to find a document loses everything and starts over. It is a page rather than a sheet because the prep is the
 * whole content — a modal that needs scrolling to reach its own CTA reads as
 * an interruption, not as the step it actually is.
 *
 * The CTA calls `start` straight out of the click: the reserved tab depends on
 * that user gesture (see useBridgeHostedVerification).
 */
export const AdditionalVerificationView = () => {
    const t = useTranslations('kyc.hostedPrep')
    const tPrep = useTranslations('kyc.prep')
    const tCommon = useTranslations('common')
    const onBack = useSafeBack('/profile/identity-verification')
    const { start, isStarting, error } = useBridgeHostedVerification()

    return (
        <div className="flex w-full flex-col gap-6">
            <NavHeader title={t('title')} onPrev={onBack} />

            <div className="flex flex-col items-center gap-3 text-center">
                <IconBubble icon="user-id" size="l" color="yellow" />
                <p className="text-body-s text-foreground-secondary">{t('description')}</p>
            </div>

            <KycPrepChecklist path="hosted" />

            <div className="flex flex-col gap-3">
                {error && <p className="text-body-s text-error">{error}</p>}
                <Button
                    variant="purple"
                    shadowSize="4"
                    icon="check-circle"
                    iconPosition="left"
                    disabled={isStarting}
                    onClick={start}
                >
                    {isStarting ? tCommon('loading') : tPrep('startCta')}
                </Button>
                <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
            </div>
        </div>
    )
}
