'use client'

/**
 * The KycPrepChecklist rework, as real renders — the block InitiateKycModal and
 * UnlockMethodModal both host. Harness-only.
 */

import { useTranslations } from 'next-intl'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'

const ITEMS = ['id', 'selfie'] as const

/** A — minimal bullets, the version the review recorded as final. */
export function KycChecklistA() {
    const t = useTranslations('kyc.prep')
    return (
        <div className="flex w-full flex-col gap-3 p-6 text-left">
            <p className="text-body-s">{t('intro.standard')}</p>
            <ul className="flex flex-col gap-3">
                {ITEMS.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground-primary" />
                        <span>
                            <span className="block text-label-l">{t(`items.${item}.title`)}</span>
                            <span className="block text-body-xs text-foreground-secondary">
                                {t(`items.${item}.body`)}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="text-body-xs text-foreground-secondary">{t('extraDocNote')}</p>
            <div className="flex flex-col gap-0.5">
                <span className="text-label-m tracking-wide uppercase">{t('howLongLabel')}</span>
                <span className="text-body-xs text-foreground-secondary">{t('howLong.standard')}</span>
            </div>
        </div>
    )
}

/** B — DataRow, the version you remember. */
export function KycChecklistB() {
    const t = useTranslations('kyc.prep')
    return (
        <div className="flex w-full flex-col gap-3 p-6 text-left">
            <p className="text-body-s">{t('intro.standard')}</p>
            <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                {ITEMS.map((item) => (
                    <DataRow key={item} label={t(`items.${item}.title`)} value={t(`items.${item}.body`)} />
                ))}
            </Card>
            <p className="text-body-xs text-foreground-secondary">{t('extraDocNote')}</p>
            <div className="flex flex-col gap-0.5">
                <span className="text-label-m tracking-wide uppercase">{t('howLongLabel')}</span>
                <span className="text-body-xs text-foreground-secondary">{t('howLong.standard')}</span>
            </div>
        </div>
    )
}
