'use client'

import { Root, List, Trigger } from '@radix-ui/react-tabs'

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
    return (
        <Root value={value} onValueChange={(v) => onChange(v as Period)} className={className}>
            <List className="flex items-center rounded-xl bg-grey-4 p-0" aria-label="Select period">
                <Trigger
                    value="monthly"
                    className="rounded-xl border border-transparent px-3 py-1 text-xs font-medium text-grey-1 transition-all data-[state=active]:border-primary-1 data-[state=active]:bg-primary-1/10 data-[state=active]:text-primary-1"
                >
                    Monthly
                </Trigger>
                <Trigger
                    value="yearly"
                    className="rounded-xl border border-transparent px-3 py-1 text-xs font-medium text-grey-1 transition-all data-[state=active]:border-primary-1 data-[state=active]:bg-primary-1/10 data-[state=active]:text-primary-1"
                >
                    Yearly
                </Trigger>
            </List>
        </Root>
    )
}
