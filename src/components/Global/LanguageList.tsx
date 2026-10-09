'use client'

import Image from 'next/image'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'

/**
 * ISO-2 country per locale, for the row flag. `es-419` is UN region 419 (Latin
 * American Spanish) and has no country of its own; it flies the Spain flag
 * because a flag row next to a globe row reads as a broken image, and Spain is
 * the flag people already associate with "Spanish".
 */
const LOCALE_FLAG_CODES: Record<AppLocale, string> = {
    en: 'us',
    'es-419': 'es',
    'es-AR': 'ar',
    'pt-BR': 'br',
}

/** The app language rows, shared by settings and the signup language drawer. */
export const LanguageList = ({ onSelect }: { onSelect: (locale: AppLocale) => void }) => {
    const { locale } = useAppLocale()
    // one wrapper div: a parent's gap would otherwise land between the rows
    // and break the joined list geometry
    return (
        <div>
            {APP_LOCALES.map((appLocale, index) => {
                const isSelected = appLocale === locale
                // selected-row rule from design.md: pale-blue fill, over-color ink, painted check
                const paint = isSelected ? 'text-foreground-over-color-primary' : 'text-foreground-primary'
                return (
                    <ListItem
                        key={appLocale}
                        position={getCardPosition(index, APP_LOCALES.length)}
                        onClick={() => onSelect(appLocale)}
                        className={isSelected ? 'bg-background-selection' : undefined}
                        leading={
                            <Image
                                src={getFlagUrl(LOCALE_FLAG_CODES[appLocale])}
                                alt=""
                                width={80}
                                height={80}
                                className="size-6 rounded-full object-cover"
                            />
                        }
                        title={
                            <span className={`text-body-m ${paint}`} lang={appLocale}>
                                {LOCALE_LABELS[appLocale]}
                            </span>
                        }
                        trailing={isSelected ? <Icon name="check" size={20} className={paint} /> : undefined}
                    />
                )
            })}
        </div>
    )
}
