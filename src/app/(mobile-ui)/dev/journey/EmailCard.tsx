'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { REVIEW_PENDING_CLASS, decisionFlagFor, examplesForStep, renderId } from './emailReview'
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
        <ListItem
            className={pending ? REVIEW_PENDING_CLASS : undefined}
            onClick={() => onOpen(step.type, 0)}
            title={step.subject}
            bodyWrap
            body={
                <div className="flex flex-col gap-1">
                    <p>{step.preview}</p>
                    <p>
                        <strong>{step.ctaText}</strong> → {step.ctaPath}
                    </p>
                    {decision && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-label-m text-foreground-primary">{decision.label}</span>
                            <p className="text-body-xs leading-snug">{decision.note}</p>
                        </div>
                    )}
                    {examples.length > 1 && (
                        <p className="text-body-xs leading-snug">
                            {examples.length} copy variants: {examples.map((example) => example.label).join(' / ')}
                        </p>
                    )}
                    {showDev && <p className="truncate font-mono text-body-xs">{step.type}</p>}
                </div>
            }
            trailing={
                <div className="flex flex-col items-end gap-1">
                    {typeof step.afterDaysStuck === 'number' && <StuckBadge days={step.afterDaysStuck} />}
                    <span className="text-label-m text-foreground-secondary">
                        {pending
                            ? `needs verdict${examples.length > 1 ? ` ${reviewedCount}/${examples.length}` : ''}`
                            : 'reviewed'}
                    </span>
                </div>
            }
        />
    )
}
