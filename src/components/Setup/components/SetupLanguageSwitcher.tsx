'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { DrawerSelect } from '@/components/0_Bruddle/DrawerSelect'
import { Icon } from '@/components/Global/Icons/Icon'
import { LANGUAGE_OPTIONS } from '@/components/Global/languageOptions'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useAppLocale } from '@/i18n/app/locale-context'
import { useTranslations } from 'next-intl'

/** Shared ghost trigger and language rows, beside the setup progress indicator. */
export function SetupLanguageSwitcher() {
    const t = useTranslations('settings.language')
    const { locale, setLocale } = useAppLocale()
    const { track } = useSignupControl()
    return (
        <DrawerSelect
            title={t('title')}
            options={LANGUAGE_OPTIONS}
            value={locale}
            onChange={(next) => {
                track('language', 'select', next)
                return setLocale(next)
            }}
            onOpen={() => track('language', 'open')}
            onDismiss={() => track('language', 'dismiss')}
            trigger={
                <Button variant="ghost" aria-label={t('title')} className="pointer-events-auto w-fit shrink-0 gap-1">
                    {locale.split('-')[0].toUpperCase()}
                    <Icon name="chevron-down" size={20} />
                </Button>
            }
        />
    )
}
