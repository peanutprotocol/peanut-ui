'use client'
import { type FC, useState } from 'react'
import Image from 'next/image'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Divider } from '@/components/0_Bruddle/Divider'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import VISA_BRAND_MARK from '@/assets/cards/visa-brand-mark.png'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

const PHONE_WALLETS = {
    [DeviceType.IOS]: { name: 'Apple\u00a0Pay', logo: '/wallet/apple/apple-pay-logo.svg', width: 120, height: 55 },
    [DeviceType.ANDROID]: {
        name: 'Google\u00a0Pay',
        logo: '/wallet/google/google-pay-logo.svg',
        width: 523,
        height: 228,
    },
} as const

interface Props {
    onApply: () => void | Promise<void>
    onPrev?: () => void
    applyError?: string | null
    needsFundingBeforeApply?: boolean
}

const AddCardEntryScreen: FC<Props> = ({ onApply, onPrev, applyError, needsFundingBeforeApply = false }) => {
    const t = useTranslations('card')
    const tAdd = useTranslations('addMoney')
    const format = useFormatter()
    const { deviceType } = useDeviceType()
    const wallet = deviceType === DeviceType.WEB ? null : PHONE_WALLETS[deviceType]
    const walletName =
        wallet?.name ??
        format.list([PHONE_WALLETS[DeviceType.IOS].name, PHONE_WALLETS[DeviceType.ANDROID].name], {
            type: 'disjunction',
        })
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
                <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
                    <Image src={VISA_BRAND_MARK} alt="" className="h-6 w-auto" />
                    <p className="text-body-s text-foreground-secondary">{t('entry.visaAcceptance')}</p>
                </div>
                <Divider orientation="vertical" />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
                    {wallet ? (
                        // the wallet symbol is as tall as the Visa letters; the y descender hangs into the gap
                        <div className="h-6">
                            <Image
                                src={wallet.logo}
                                alt=""
                                width={wallet.width}
                                height={wallet.height}
                                unoptimized
                                className="h-8 w-auto max-w-none"
                            />
                        </div>
                    ) : (
                        <Icon name="wallet" size={24} />
                    )}
                    <p className="text-body-s text-foreground-secondary">
                        {t('entry.contactless', { wallet: walletName })}
                    </p>
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
