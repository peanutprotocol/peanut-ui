'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import type { CompareColumn } from './useCompareColumns'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

/**
 * The 07 compare panel: the picking rule, then the two countries side by side with what each unlocks, and the
 * currency note when a column spans more than one currency. Columns without items show only flag and name. The
 * block stops 16 px above the CTA and scrolls if a long list does not fit (a 320 phone with four currencies).
 */
export function ResidenceCompareView({
    columns,
    labelOf,
    currencyNote,
}: {
    columns: CompareColumn[]
    labelOf: (iso2: string) => string
    currencyNote: boolean
}) {
    const t = useTranslations('setupRedesign.residence')
    return (
        <div
            className="flex max-h-[calc(var(--sr-panel-to-cta)-var(--sr-lift-2)-16px)] flex-col overflow-y-auto"
            data-setup-screen="residence"
        >
            <p className={SETUP_LEAD_CLASS}>{t('compareRule')}</p>
            <div className="mt-4 flex gap-4 signup-sm:mt-3 signup-sm:gap-3">
                {columns.map(({ iso2, items }, index) => (
                    <div key={iso2} className="contents">
                        {index > 0 && (
                            <div
                                aria-hidden="true"
                                className="w-0 shrink-0 border-l border-dashed border-border-default"
                            />
                        )}
                        <section
                            className="min-w-0 flex-1"
                            data-compare-column={iso2}
                            data-testid={`setup-redesign-residence-column-${iso2}`}
                        >
                            <h2 className="flex flex-col items-start gap-1.5 text-heading-card break-words signup-sm:flex-row signup-sm:items-center">
                                <Image
                                    src={getFlagUrl(iso2.toLowerCase())}
                                    alt=""
                                    width={64}
                                    height={64}
                                    className="size-8 shrink-0 rounded-full object-cover signup-sm:size-6"
                                />
                                {labelOf(iso2)}
                            </h2>
                            {items.length > 0 && (
                                <BulletList
                                    size="xs"
                                    items={items}
                                    className="mt-2 gap-1.5 signup-sm:mt-1 signup-sm:gap-0.5"
                                />
                            )}
                        </section>
                    </div>
                ))}
            </div>
            {currencyNote && <p className="mt-2 text-body-xs text-foreground-secondary">{t('compareCurrencyNote')}</p>}
        </div>
    )
}
