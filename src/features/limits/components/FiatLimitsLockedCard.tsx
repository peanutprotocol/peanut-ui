'use client'

import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

/** Prompt to unlock fiat payments (bank deposits/withdraws + QR pay). */
export default function FiatLimitsLockedCard() {
    const t = useTranslations('limits.fiatLocked')
    const router = useRouter()

    return (
        <div className="space-y-2">
            <h2 className="font-bold">{t('title')}</h2>
            <Card position="single" className="p-0">
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary-1">
                        <Icon name="globe-lock" size={20} />
                    </div>
                    <div className="text-center">
                        <div className="font-bold">{t('locked')}</div>
                        <div className="mt-1 text-sm text-grey-1">{t('description')}</div>
                    </div>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        size="medium"
                        onClick={() => router.push('/profile/identity-verification')}
                        className="mt-2"
                    >
                        {t('cta')}
                    </Button>
                </div>
            </Card>
        </div>
    )
}
