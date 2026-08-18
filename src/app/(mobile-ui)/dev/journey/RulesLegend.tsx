'use client'

import StuckBadge from './StuckBadge'
import type { SpecRules } from './journeyTypes'

function Rule({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 rounded-sm border border-n-1 bg-white px-2 py-1">
            <span className="text-[10px] font-bold tracking-wide text-grey-1 uppercase">{label}</span>
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
            {/* The two nudge rules render the very badge the board stamps on each email. */}
            <Rule label="nudge 1">
                <StuckBadge days={rules.step1AfterDays} />
            </Rule>
            <Rule label="nudge 2">
                <StuckBadge days={rules.step2AfterDays} />
            </Rule>
            <Rule label="governor">
                <span className="text-xs font-bold">≥{rules.governorDays}d between emails</span>
            </Rule>
            <Rule label="freshness">
                <span className="text-xs font-bold">{rules.freshnessDays}d window</span>
            </Rule>
            <Rule label="holdout">
                <span className="text-xs font-bold">{Math.round(rules.holdoutFraction * 100)}% control</span>
            </Rule>
            <Rule label="balance gate">
                <span className="text-xs font-bold">fund ≤ $0.10 · spend ≥ $1 (live chain read)</span>
            </Rule>
            <Rule label="send window">
                <span className="text-xs font-bold">
                    {rules.sendWindowUtc.startHour}–{rules.sendWindowUtc.endHour}h UTC
                </span>
            </Rule>
            <Rule label="cap">
                <span className="text-xs font-bold">{rules.maxSendsPerCycle}/cycle</span>
            </Rule>
        </div>
    )
}
