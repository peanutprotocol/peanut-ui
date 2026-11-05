'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { WORDMARK } from '@/assets/brand'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

export function PublicReceiptIssuer() {
    const t = useAppTranslations('transaction')
    const tNav = useTranslations('navigation')

    return (
        <div className="flex items-start justify-between gap-4">
            <Image src={WORDMARK} alt={tNav('peanutLogoAlt')} className="h-6 w-auto shrink-0" />
            <p className="text-right text-body-xs text-foreground-secondary">
                <span className="text-body-m-semibold text-foreground-primary">{t('officialReceipt.issuedBy')}</span>{' '}
                <a
                    href="https://peanut.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline print:no-underline"
                >
                    {'peanut.me'}
                </a>
            </p>
        </div>
    )
}
