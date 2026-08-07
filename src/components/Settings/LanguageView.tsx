'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/AppIntlProvider'

const positionFor = (index: number) => (index === 0 ? 'first' : index === APP_LOCALES.length - 1 ? 'last' : 'middle')

export const LanguageView = () => {
    const t = useTranslations('settings.language')
    const { locale, setLocale } = useAppLocale()
    const onBack = useSafeBack('/profile')
    const [switching, setSwitching] = useState<AppLocale | null>(null)

    const select = async (next: AppLocale) => {
        if (next === locale || switching) return
        setSwitching(next)
        try {
            await setLocale(next)
        } finally {
            setSwitching(null)
        }
    }

    return (
        <div className="h-full w-full bg-background">
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="pt-4">
                {APP_LOCALES.map((appLocale, index) => (
                    <Card
                        key={appLocale}
                        position={positionFor(index)}
                        onClick={() => select(appLocale)}
                        className="cursor-pointer p-4 active:bg-grey-4"
                    >
                        <div className="flex items-center justify-between py-1">
                            <span className="text-base font-medium" lang={appLocale}>
                                {LOCALE_LABELS[appLocale]}
                            </span>
                            {appLocale === locale && <Icon name="check" size={20} fill="black" />}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
