'use client'

import DocsLink from '@/components/Global/DocsLink'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { useTranslations } from 'next-intl'

export default function LimitsDocsLink() {
    const t = useTranslations('limits')
    return (
        <div className="text-center">
            {/* DocsLink keeps the locale + native behavior; the chrome is LinkButton's. */}
            <DocsLink href="/en/help/transaction-limits" className={LINK_BUTTON_CLASSES}>
                {t('docsLink')}
            </DocsLink>
        </div>
    )
}
