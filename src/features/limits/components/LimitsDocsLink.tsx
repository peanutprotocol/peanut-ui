'use client'

import DocsLink from '@/components/Global/DocsLink'
import { useTranslations } from 'next-intl'

export default function LimitsDocsLink() {
    const t = useTranslations('limits')
    return (
        <DocsLink href="/en/help/transaction-limits" className="text-center text-body-s underline">
            {t('docsLink')}
        </DocsLink>
    )
}
