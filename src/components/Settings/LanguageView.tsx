'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { LanguageList } from '@/components/Global/LanguageList'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { type AppLocale } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'

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
        <PageStack gap="6" className="h-full bg-background-page">
            <NavHeader title={t('title')} onPrev={onBack} />
            {/* top-aligned list page (design.md list recipe), not PageStack.Center:
                a short settings list floating mid-screen read as misplaced */}
            <LanguageList onSelect={select} />
        </PageStack>
    )
}
