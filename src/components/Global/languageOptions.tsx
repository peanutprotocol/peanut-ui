import Image from 'next/image'
import { type SelectOption } from '@/components/0_Bruddle/SelectList.types'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/app/config'

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

/** The app languages as select rows, shared by settings and the sign-up language drawer. */
export const LANGUAGE_OPTIONS: SelectOption<AppLocale>[] = APP_LOCALES.map((locale) => ({
    value: locale,
    label: LOCALE_LABELS[locale],
    lang: locale,
    leading: (
        <Image
            src={getFlagUrl(LOCALE_FLAG_CODES[locale])}
            alt=""
            width={80}
            height={80}
            className="size-6 rounded-full object-cover"
        />
    ),
}))
