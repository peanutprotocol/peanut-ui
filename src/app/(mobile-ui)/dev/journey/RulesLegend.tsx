'use client'

import StuckBadge from './StuckBadge'
import type { SpecRules } from './journeyTypes'

function Rule({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 rounded-sm border border-n-1 bg-white px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-grey-1">{label}</span>
            {children}
        </div>
    )
}

/** Compact legend strip for the email machine's global rules (from spec.rules). */
export default function RulesLegend({ rules, specError }: { rules: SpecRules | null; specError: string | null }) {
    if (!rules) {
        return (
            <div className="rounded-sm border border-n-1 bg-yellow-1/40 p-3 text-sm">
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
                <span className="text-xs font-bold">≥{rules.governorDays}d between emails</span>
            </Rule>
            <Rule label="freshness">
                <span className="text-xs font-bold">{rules.freshnessDays}d window</span>
            </Rule>
            <Rule label="dormancy">
                <span className="text-xs font-bold">{rules.dormancyDays}d silent → win_back</span>
            </Rule>
            <Rule label="holdout">
                <span className="text-xs font-bold">{Math.round(rules.holdoutFraction * 100)}% control</span>
            </Rule>
            <Rule label="balance gate">
                <span className="text-xs font-bold">
                    fund ≤ $0.10 · spend ≥ $1 (live chain read; ≥ $1 re-routes fund → first_spend)
                </span>
            </Rule>
            <Rule label="send window">
                <span className="text-xs font-bold">
                    {rules.sendWindowUtc.startHour}–{rules.sendWindowUtc.endHour}h UTC
                </span>
            </Rule>
            <Rule label="cap">
                <span className="text-xs font-bold">
                    {rules.maxSendsPerCycle}/cycle · {rules.maxSendsPerDay}/day
                </span>
            </Rule>
        </div>
    )
}
