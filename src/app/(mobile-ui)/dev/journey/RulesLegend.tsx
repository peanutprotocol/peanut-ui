'use client'

import StuckBadge from './StuckBadge'
import type { SpecRules } from './journeyTypes'

function Rule({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 rounded-sm border border-border-default bg-white px-2 py-1">
            <span className="text-[10px] font-bold tracking-wide text-foreground-secondary uppercase">{label}</span>
            {children}
        </div>
    )
}

/** Compact legend strip for the email machine's global rules (from spec.rules). */
export default function RulesLegend({ rules, specError }: { rules: SpecRules | null; specError: string | null }) {
    if (!rules) {
        return (
            <div className="rounded-sm border border-border-default bg-action-secondary/40 p-3 text-body-s">
                {specError ?? 'Loading email-machine rules…'}
            </div>
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
