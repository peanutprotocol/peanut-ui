'use client'

import type { SpecRules } from './journeyTypes'

function Chip({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5 rounded-sm border border-n-1 bg-white px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-grey-1">{label}</span>
            <span className="text-xs font-bold">{value}</span>
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
            <Chip label="nudge 1" value={`day ${rules.step1AfterDays} stuck`} />
            <Chip label="nudge 2" value={`day ${rules.step2AfterDays} stuck`} />
            <Chip label="governor" value={`≥${rules.governorDays}d between emails`} />
            <Chip label="freshness" value={`${rules.freshnessDays}d window`} />
            <Chip label="holdout" value={`${Math.round(rules.holdoutFraction * 100)}% control`} />
            <Chip label="send window" value={`${rules.sendWindowUtc.startHour}–${rules.sendWindowUtc.endHour}h UTC`} />
            <Chip label="cap" value={`${rules.maxSendsPerCycle}/cycle`} />
        </div>
    )
}
