'use client'

import { Root, List, Trigger } from '@radix-ui/react-tabs'
import { useTranslations } from 'next-intl'

type Period = 'monthly' | 'yearly'

interface PeriodToggleProps {
    value: Period
    onChange: (period: Period) => void
    className?: string
}

/**
 * pill toggle for switching between monthly and yearly limit views
 * uses radix tabs for accessibility
 */
export default function PeriodToggle({ value, onChange, className }: PeriodToggleProps) {
    const t = useTranslations('limits.period')
    return (
        <Root value={value} onValueChange={(v) => onChange(v as Period)} className={className}>
            <List className="flex items-center rounded-xl bg-grey-4 p-0" aria-label={t('selectAriaLabel')}>
                <Trigger
                    value="monthly"
                    className="rounded-sm border border-transparent px-3 py-1 text-label-m text-foreground-secondary transition-all duration-fast data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary"
                >
                    {t('monthly')}
                </Trigger>
                <Trigger
                    value="yearly"
                    className="rounded-sm border border-transparent px-3 py-1 text-label-m text-foreground-secondary transition-all duration-fast data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary"
                >
                    {t('yearly')}
                </Trigger>
            </List>
        </Root>
    )
}
