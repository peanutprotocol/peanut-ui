'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { useSafeBack } from '@/hooks/useSafeBack'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/AppIntlProvider'

/**
 * ISO-2 country per locale, for the row flag. `es-419` is UN region 419
 * (Latin American Spanish) and has no country of its own — a Spain flag would
 * name the wrong variant, and the `xx` fallback renders as a grey question
 * mark that reads like a broken image. Those rows get the globe icon instead.
 */
const LOCALE_FLAG_CODES: Record<AppLocale, string | null> = {
    en: 'us',
    'es-419': null,
    'es-AR': 'ar',
    'pt-BR': 'br',
}

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
                    <ListItem
                        key={appLocale}
                        position={getCardPosition(index, APP_LOCALES.length)}
                        onClick={() => select(appLocale)}
                        leading={
                            LOCALE_FLAG_CODES[appLocale] ? (
                                <Image
                                    src={getFlagUrl(LOCALE_FLAG_CODES[appLocale])}
                                    alt=""
                                    width={80}
                                    height={80}
                                    className="size-6 rounded-full object-cover"
                                />
                            ) : (
                                <Icon name="globe" size={24} className="text-foreground-primary" />
                            )
                        }
                        title={
                            <span className="text-body-m text-foreground-primary" lang={appLocale}>
                                {LOCALE_LABELS[appLocale]}
                            </span>
                        }
                        trailing={appLocale === locale ? <Icon name="check" size={20} /> : undefined}
                    />
                ))}
            </div>
        </div>
    )
}
