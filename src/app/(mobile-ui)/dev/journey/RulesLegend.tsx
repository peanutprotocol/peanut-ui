'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { Notification } from '@/components/0_Bruddle/Notification'
import StuckBadge from './StuckBadge'
import type { SpecRules } from './journeyTypes'

function Rule({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Card className="flex-row items-center gap-2 px-2 py-1">
            <span className="text-label-m text-foreground-secondary">{label}</span>
            {children}
        </Card>
    )
}

/** Compact legend strip for the email machine's global rules (from spec.rules). */
export default function RulesLegend({ rules, specError }: { rules: SpecRules | null; specError: string | null }) {
    if (!rules) {
        return (
            <Notification priority={specError ? 'error' : 'info'}>
                {specError ?? 'Loading email-machine rules…'}
            </Notification>
        )
    }
    return (
        <div className="flex flex-wrap gap-2">
            {/* One nudge rule per ladder step — stages carry 2 or 3 steps in v2. */}
            {rules.stepAfterDays.map((days, i) => (
                <Rule key={i} label={`nudge ${i + 1}`}>
                    <StuckBadge days={days} />
                </Rule>
            ))}
            <Rule label="governor">
                <span className="text-label-m">≥{rules.governorDays}d between emails</span>
            </Rule>
            <Rule label="freshness">
                <span className="text-label-m">{rules.freshnessDays}d window</span>
            </Rule>
            <Rule label="dormancy">
                <span className="text-label-m">{rules.dormancyDays}d silent → win_back</span>
            </Rule>
            <Rule label="holdout">
                <span className="text-label-m">{Math.round(rules.holdoutFraction * 100)}% control</span>
            </Rule>
            <Rule label="balance gate">
                <span className="text-label-m">
                    fund ≤ $0.10 · spend ≥ $1 (live chain read; ≥ $1 re-routes fund → first_spend)
                </span>
            </Rule>
            <Rule label="send window">
                <span className="text-label-m">
                    {rules.sendWindowUtc.startHour}–{rules.sendWindowUtc.endHour}h UTC
                </span>
            </Rule>
            <Rule label="cap">
                <span className="text-label-m">
                    {rules.maxSendsPerCycle}/cycle · {rules.maxSendsPerDay}/day
                </span>
            </Rule>
        </div>
    )
}
