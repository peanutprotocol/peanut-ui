'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { LanguageList } from '@/components/Global/LanguageList'
import { type AppLocale } from '@/i18n/app/config'
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
                    <LanguageList onSelect={(value) => void choose(value)} />
                </div>
            </DrawerContent>
        </Drawer>
    )
}
