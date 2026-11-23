import Image from 'next/image'
import { type SelectOption } from '@/components/0_Bruddle/SelectList.types'
import { APP_LOCALES, LOCALE_LABELS, MARKETING_SEGMENT, type AppLocale } from '@/i18n/app/config'
import { LOCALE_META } from '@/i18n/localeMeta'

/** The app languages as select rows, shared by settings and the sign-up language drawer. */
export const LANGUAGE_OPTIONS: SelectOption<AppLocale>[] = APP_LOCALES.map((locale) => ({
    value: locale,
    label: LOCALE_LABELS[locale],
    lang: locale,
    leading: (
        <Image
            // one flag per language, the one the Help Center switcher flies (es-419: Mexico, TASK-23929)
            src={LOCALE_META[MARKETING_SEGMENT[locale]].flag}
            alt=""
            width={80}
            height={80}
            className="size-6 rounded-full object-cover"
        />
    ),
}))
