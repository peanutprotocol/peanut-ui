'use client'

import { twMerge } from '@/utils/tw'
import DevChip from '../_components/DevChip'
import { REVIEW_PENDING_CLASS, decisionFlagFor, emailPreviewUrl, examplesForStep, renderId } from './emailReview'
import StuckBadge from './StuckBadge'
import type { SpecEmailStep } from './journeyTypes'

/**
 * Compact card for one lifecycle email step.
 *
 * Doubles as the review unit: until every one of the email's renders has a
 * verdict the card carries the amber dashed `review-pending` treatment and a
 * "needs verdict" chip, so what still needs a product call is legible from
 * across the board. Clicking opens the in-place preview panel; the `raw ↗` link
 * stays as the external fallback.
 */
export default function EmailCard({
    step,
    showDev,
    isReviewed,
    onOpen,
}: {
    step: SpecEmailStep
    showDev: boolean
    isReviewed: (id: string) => boolean
    onOpen: (eventType: string, example: number) => void
}) {
    const examples = examplesForStep(step)
    const reviewedCount = examples.filter((example) => isReviewed(renderId(step.type, example.index))).length
    const pending = reviewedCount < examples.length
    const decision = decisionFlagFor(step.type)

    return (
        <div
            data-review-state={pending ? 'pending' : 'reviewed'}
            data-email-type={step.type}
            className={twMerge('rounded-sm border border-border-default bg-white', pending && REVIEW_PENDING_CLASS)}
        >
            <button
                type="button"
                onClick={() => onOpen(step.type, 0)}
                className="block w-full p-2.5 text-left hover:bg-purple-200/30"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="text-label-m leading-tight">{step.subject}</div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        {typeof step.afterDaysStuck === 'number' && <StuckBadge days={step.afterDaysStuck} />}
                        {pending ? (
                            <DevChip tone="yellow" title="No product verdict recorded for this copy yet.">
                                needs verdict{examples.length > 1 && ` ${reviewedCount}/${examples.length}`}
                            </DevChip>
                        ) : (
                            <DevChip tone="green" title="Marked reviewed in the preview panel.">
                                reviewed ✓
                            </DevChip>
                        )}
                    </div>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-foreground-secondary">{step.preview}</p>
                <p className="mt-1 text-[11px] leading-snug">
                    <span className="rounded-sm bg-action-secondary px-1 font-bold">{step.ctaText}</span>
                    <span className="text-foreground-secondary"> → {step.ctaPath}</span>
                </p>
                {decision && (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                        <DevChip tone="pink" className="self-start" title={decision.note}>
                            {decision.label}
                        </DevChip>
                        <p className="text-[10px] leading-snug text-foreground-secondary">{decision.note}</p>
                    </div>
                )}
                {examples.length > 1 && (
                    <p className="mt-1 text-[10px] leading-snug text-foreground-secondary">
                        {examples.length} copy variants: {examples.map((example) => example.label).join(' / ')}
                    </p>
                )}
            </button>
            <div className="flex items-center justify-between gap-2 border-t border-border-default px-2.5 py-1">
                <span className="truncate font-mono text-[9px] leading-tight text-foreground-secondary">
                    {showDev ? step.type : 'click to review'}
                </span>
                <a
                    href={emailPreviewUrl(step.type, 0, false)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[9px] font-bold text-black underline"
                >
                    raw ↗
                </a>
            </div>
        </div>
    )
}
