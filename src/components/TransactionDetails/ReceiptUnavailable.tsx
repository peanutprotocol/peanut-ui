'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import PEANUT_LOGO from '@/assets/logos/peanut-logo.svg'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'

/**
 * Branded terminal state for a receipt link that cannot render: 'gone' for
 * legacy `?t=` links whose id no longer resolves (pre-May-2026 share URLs),
 * 'loadFailed' for a transient fetch/transform failure worth retrying.
 */
export function ReceiptUnavailable({ variant = 'gone' }: { variant?: 'gone' | 'loadFailed' }) {
    const t = useTranslations('transaction.receiptUnavailable')
    const tCommon = useTranslations('common')
    const tNav = useTranslations('navigation')

    return (
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
            <Image src={PEANUT_LOGO} alt={tNav('peanutLogoAlt')} className="w-28" />
            <Card position="single" className="w-full space-y-2 px-6 py-8">
                <h1 className="text-lg font-bold text-black">
                    {variant === 'gone' ? t('title') : t('loadFailedTitle')}
                </h1>
                <p className="text-sm text-grey-1">
                    {variant === 'gone' ? t('description') : t('loadFailedDescription')}
                </p>
            </Card>
            <Link href="/home" className="w-full print:hidden">
                <Button variant="purple" shadowSize="4" className="w-full">
                    {tCommon('goToHome')}
                </Button>
            </Link>
        </div>
    )
}
