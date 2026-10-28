'use client'
import { type FC, useState } from 'react'
import Image from 'next/image'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Divider } from '@/components/0_Bruddle/Divider'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import VISA_BRAND_MARK from '@/assets/cards/visa-brand-mark.png'

interface Props {
    onApply: () => void | Promise<void>
    onPrev?: () => void
    applyError?: string | null
    needsFundingBeforeApply?: boolean
}

const AddCardEntryScreen: FC<Props> = ({ onApply, onPrev, applyError, needsFundingBeforeApply = false }) => {
    const t = useTranslations('card')
    const tAdd = useTranslations('addMoney')
    const [isApplying, setIsApplying] = useState(false)

    const handleClick = async () => {
        setIsApplying(true)
        try {
            await onApply()
        } finally {
            setIsApplying(false)
        }
    }
    return (
        <PageStack gap="6">
            <NavHeader title={t('entry.navTitle')} onPrev={onPrev} />

            <ScaledPixelatedCardFace last4="????" />

            <div className="flex flex-col gap-2">
                <h1 className="text-heading-s text-foreground-primary">{t('entry.title')}</h1>
                <p className="text-foreground-secondary">{t('entry.description')}</p>
                {needsFundingBeforeApply && <p className="text-foreground-secondary">{t('onboarding.fundingBody')}</p>}
            </div>

            <div className="flex gap-6 py-4">
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                    <Image src={VISA_BRAND_MARK} alt="" className="h-6 w-auto" />
                    <p className="text-body-s text-foreground-secondary">{t('entry.visaAcceptance')}</p>
                </div>
                <Divider orientation="vertical" />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                    {/* the logo's G is as tall as the Visa letters; the y's descender hangs into the gap */}
                    <div className="h-6">
                        <Image
                            src="/wallet/google/google-pay-logo.svg"
                            alt=""
                            width={523}
                            height={228}
                            unoptimized
                            className="h-8 w-auto max-w-none"
                        />
                    </div>
                    <p className="text-body-s text-foreground-secondary">{t('entry.googlePay')}</p>
                </div>
            </div>

            <PageStack.Footer>
                {/* Error above the CTA, not below: the (mobile-ui) layout pins a
                 * QR FAB at the bottom-center that pokes ~27px UP into the page,
                 * so any text rendered immediately below the CTA gets bisected
                 * by it. Other surfaces (Withdraw, Send link) get away with
                 * below-CTA because their pages scroll; this one fits the
                 * viewport so the FAB collision is unavoidable. */}
                {applyError && <Callout priority="error">{applyError}</Callout>}
                <Button
                    onClick={handleClick}
                    loading={isApplying}
                    disabled={isApplying}
                    variant="primary"
                    shadowSize="4"
                    className="w-full"
                >
                    {needsFundingBeforeApply ? tAdd('title') : t('entry.cta')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

export default AddCardEntryScreen
