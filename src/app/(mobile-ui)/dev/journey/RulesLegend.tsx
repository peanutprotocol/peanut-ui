'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { Callout } from '@/components/0_Bruddle/Callout'
import type { SpecRules } from './journeyTypes'

function Rule({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Card className="flex-row items-center gap-2 px-2 py-1">
            <span className="text-label-m text-foreground-secondary">{label}</span>
            {children}
        </Card>
    )
}

const clock = (minuteOfDay: number) =>
    `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`

/** Compact legend strip for the nudge engine's global rules (from spec.rules); each step's cadence is on the funnel map. */
export default function RulesLegend({ rules, specError }: { rules: SpecRules | null; specError: string | null }) {
    if (!rules) {
        return <Callout priority={specError ? 'error' : 'info'}>{specError ?? 'Loading email-machine rules…'}</Callout>
    }
    return (
        <div className="flex flex-wrap gap-2">
            <Rule label="gap">
                <span className="text-label-m">≥{rules.minGapHours}h between nudges of one step</span>
            </Rule>
            <Rule label="idle">
                <span className="text-label-m">{rules.idleMinutes} min after the last request</span>
            </Rule>
            <Rule label="quiet hours">
                <span className="text-label-m">
                    push waits {clock(rules.quietHours.fromMinute)}–{clock(rules.quietHours.untilMinute)} local
                </span>
            </Rule>
            <Rule label="freshness">
                <span className="text-label-m">{rules.freshnessDays}d in the step</span>
            </Rule>
            <Rule label="dormancy">
                <span className="text-label-m">{rules.dormancyDays}d silent → win_back</span>
            </Rule>
            <Rule label="holdout">
                <span className="text-label-m">{Math.round(rules.holdoutFraction * 100)}% control</span>
            </Rule>
            <Rule label="balance gate">
                <span className="text-label-m">add money ≤ $0.10 · first spend ≥ $1 (live chain read)</span>
            </Rule>
            <Rule label="cap">
                <span className="text-label-m">
                    {rules.maxSendsPerCycle}/cycle · {rules.maxSendsPerDay}/day
                </span>
            </Rule>
        </div>
    )
}
