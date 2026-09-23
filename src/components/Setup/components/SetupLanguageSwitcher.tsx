'use client'

import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'
import { useTranslations } from 'next-intl'

/** The first setup screen uses the app locale store, so the choice persists
 * across the whole flow and into the signed-in app. */
export function SetupLanguageSwitcher() {
    const t = useTranslations('settings.language')
    const { locale, setLocale } = useAppLocale()

    return (
        <div className="flex justify-center">
            <label className="flex items-center gap-2 text-body-s text-foreground-secondary">
                <span>{t('title')}</span>
                <select
                    value={locale}
                    onChange={(event) => void setLocale(event.target.value as AppLocale)}
                    className="rounded-sm border border-border-default bg-white px-2 py-1 text-body-s text-foreground-primary focus-visible:outline-[3px] focus-visible:outline-action-focus"
                >
                    {APP_LOCALES.map((option) => (
                        <option key={option} value={option} lang={option}>
                            {LOCALE_LABELS[option]}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    )
}
