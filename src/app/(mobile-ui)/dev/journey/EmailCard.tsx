'use client'

import { JOURNEY_API_BASE } from './journeyData'
import StuckBadge from './StuckBadge'
import type { SpecEmailStep } from './journeyTypes'

/**
 * Compact card for one lifecycle email step. Links to the API's live rendered
 * preview (opens in a new tab against the sandbox API).
 */
export default function EmailCard({ step, showDev }: { step: SpecEmailStep; showDev: boolean }) {
    return (
        <a
            href={`${JOURNEY_API_BASE}/__dev/email-preview/${step.type}?example=0`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-sm border border-n-1 bg-white p-2.5 hover:bg-primary-3/30"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold leading-tight">{step.subject}</div>
                {typeof step.afterDaysStuck === 'number' && <StuckBadge days={step.afterDaysStuck} />}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-grey-1">{step.preview}</p>
            <p className="mt-1 text-[11px] leading-snug">
                <span className="rounded-sm bg-yellow-1 px-1 font-bold">{step.ctaText}</span>
                <span className="text-grey-1"> → {step.ctaPath}</span>
            </p>
            <p className="mt-1.5 font-mono text-[9px] leading-tight text-grey-1">
                {showDev ? `${step.type} · preview ↗` : 'preview ↗'}
            </p>
        </a>
    )
}
