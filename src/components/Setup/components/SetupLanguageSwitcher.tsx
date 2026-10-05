'use client'

import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'
import { useTranslations } from 'next-intl'

/** Persistent app language, compact enough to share the progress row. */
export function SetupLanguageSwitcher() {
    const t = useTranslations('settings.language')
    const { locale, setLocale } = useAppLocale()
    return (
        <BaseSelect
            aria-label={t('title')}
            value={locale}
            valueLabel={locale.split('-')[0].toUpperCase()}
            onValueChange={(value) => void setLocale(value as AppLocale)}
            options={APP_LOCALES.map((option) => ({ value: option, label: LOCALE_LABELS[option] }))}
            className="text-label-s pointer-events-auto h-11 w-16 shrink-0 rounded-full bg-transparent px-3"
            contentClassName="min-w-56"
        />
    )
}
