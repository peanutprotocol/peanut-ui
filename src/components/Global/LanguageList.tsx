'use client'

import { SelectList } from '@/components/0_Bruddle/SelectList'
import { type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'
import { LANGUAGE_OPTIONS } from './languageOptions'

/** The app language rows on the settings language page. */
export const LanguageList = ({ onSelect }: { onSelect: (locale: AppLocale) => void }) => {
    const { locale } = useAppLocale()
    return <SelectList options={LANGUAGE_OPTIONS} value={locale} onSelect={onSelect} />
}
