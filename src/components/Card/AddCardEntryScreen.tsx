'use client'
import { type FC, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'

interface Props {
    onApply: () => void | Promise<void>
    onPrev?: () => void
    applyError?: string | null
}

const FEATURE_KEYS = ['entry.featureBalance', 'entry.featureControl', 'entry.featureOnline'] as const

const AddCardEntryScreen: FC<Props> = ({ onApply, onPrev, applyError }) => {
    const t = useTranslations('card')
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
            </div>

            {/* The DS checklist body — Notification's `items` slot exists
             * because hand-rolled tinted check-lists kept getting the icon
             * alignment wrong (components.md: "don't: hand-rolled tinted
             * boxes"). This was the fifth hand-roll. */}
            <Notification priority="info" items={FEATURE_KEYS.map((featureKey) => t(featureKey))} />

            {/* Error above the CTA, not below: the (mobile-ui) layout pins a
             * QR FAB at the bottom-center that pokes ~27px UP into the page,
             * so any text rendered immediately below the CTA gets bisected
             * by it. Other surfaces (Withdraw, Send link) get away with
             * below-CTA because their pages scroll; this one fits the
             * viewport so the FAB collision is unavoidable. */}
            {applyError && <Notification priority="error">{applyError}</Notification>}
            <Button
                onClick={handleClick}
                loading={isApplying}
                disabled={isApplying}
                variant="purple"
                shadowSize="4"
                className="w-full"
            >
                {t('entry.cta')}
            </Button>
        </PageStack>
    )
}

export default AddCardEntryScreen
