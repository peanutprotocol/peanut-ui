'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'
import { useTranslations } from 'next-intl'

/** Shared ghost trigger and language rows, beside the setup progress indicator. */
export function SetupLanguageSwitcher() {
    const t = useTranslations('settings.language')
    const { locale, setLocale } = useAppLocale()
    const [open, setOpen] = useState(false)
    const choose = async (value: AppLocale) => {
        await setLocale(value)
        setOpen(false)
    }
    return (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                <Button variant="ghost" aria-label={t('title')} className="pointer-events-auto w-fit shrink-0 gap-1">
                    {locale.split('-')[0].toUpperCase()}
                    <Icon name="chevron-down" size={20} />
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <div className="flex flex-col gap-4 pb-4">
                    <DrawerTitle>{t('title')}</DrawerTitle>
                    <div>
                        {APP_LOCALES.map((option, index) => (
                            <ListItem
                                key={option}
                                title={LOCALE_LABELS[option]}
                                position={index === 0 ? 'top' : index === APP_LOCALES.length - 1 ? 'bottom' : 'middle'}
                                trailing={locale === option ? <Icon name="check" size={20} /> : undefined}
                                aria-label={LOCALE_LABELS[option]}
                                onClick={() => void choose(option)}
                            />
                        ))}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
