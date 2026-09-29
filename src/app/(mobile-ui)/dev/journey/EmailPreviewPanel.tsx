'use client'

import { useEffect } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { decisionFlagFor, emailPreviewUrl } from './emailReview'
import StuckBadge from './StuckBadge'
import type { EmailRenderRef } from './journeyTypes'

/**
 * In-place reader for one email render — the review surface.
 *
 * Iframes the API's real React Email output rather than re-describing it, so
 * the verdict is recorded against exactly what the user receives. The API sends
 * `frame-ancestors 'self' http://localhost:3050` on /__dev/ responses, which is
 * what makes the embed possible at all; on any other origin the browser blocks
 * the frame and the "open raw ↗" link is the way through.
 *
 * Prev/next walk every render on the board in order, so a full copy pass is one
 * keyboard-free sweep instead of 13 separate tab-opens.
 */
export default function EmailPreviewPanel({
    renders,
    activeIndex,
    isReviewed,
    onToggleReviewed,
    onSelect,
    onClose,
}: {
    renders: EmailRenderRef[]
    activeIndex: number
    isReviewed: (id: string) => boolean
    onToggleReviewed: (id: string) => void
    onSelect: (index: number) => void
    onClose: () => void
}) {
    const active = renders[activeIndex]

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    if (!active) return null

    const siblings = renders.filter((render) => render.eventType === active.eventType)
    const decision = decisionFlagFor(active.eventType)
    const reviewed = isReviewed(active.id)
    const position = activeIndex + 1

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <Button
                type="button"
                variant="ghost"
                disableHaptics
                aria-label="Close preview"
                onClick={onClose}
                className="absolute inset-0 h-full w-full cursor-default rounded-none bg-foreground-primary/80 p-0"
            />

            <aside className="relative flex h-full w-full max-w-full flex-col border-l-2 border-border-default bg-background-default md:w-160">
                <header className="flex flex-col gap-2 border-b border-border-default p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="text-label-l leading-tight">{active.step.subject}</div>
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="font-mono text-body-xs text-foreground-secondary">
                                    {active.eventType}
                                </span>
                                {typeof active.step.afterDaysStuck === 'number' && (
                                    <StuckBadge days={active.step.afterDaysStuck} />
                                )}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            shape="square"
                            size="small"
                            icon="cancel"
                            onClick={onClose}
                            aria-label="Close preview"
                            className="w-auto shrink-0"
                        />
                    </div>

                    {decision && (
                        <Callout priority="attention" title={decision.label}>
                            {decision.note}
                        </Callout>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {siblings.length > 1 ? (
                            <Tabs
                                size="sm"
                                aria-label="Copy variant"
                                value={String(active.example)}
                                tabs={siblings.map((sibling) => ({
                                    value: String(sibling.example),
                                    label: sibling.exampleLabel,
                                }))}
                                onValueChange={(next) =>
                                    onSelect(renders.findIndex((render) => render.id === `${active.eventType}#${next}`))
                                }
                            />
                        ) : (
                            <span className="text-body-xs text-foreground-secondary">Single copy variant.</span>
                        )}
                        <LinkButton href={emailPreviewUrl(active.eventType, active.example, false)} external icon>
                            Open raw
                        </LinkButton>
                    </div>
                    <p className="text-body-xs leading-snug text-foreground-secondary">
                        Frame blank? The API only allows the embed from localhost:3050 — use open raw ↗ instead.
                    </p>
                </header>

                <div className="min-h-0 flex-1 bg-background-badge-accent/20">
                    <iframe
                        key={active.id}
                        title={`Email preview — ${active.eventType} example ${active.example}`}
                        src={emailPreviewUrl(active.eventType, active.example, true)}
                        className="h-full w-full border-0"
                    />
                </div>

                {/* pl-14 on mobile: the panel is full-screen there and the dev overlay badge sits bottom-left */}
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default p-3 pl-14 md:pl-3">
                    <Checkbox
                        label={reviewed ? 'Reviewed — copy approved' : 'Mark reviewed'}
                        value={reviewed}
                        onChange={() => onToggleReviewed(active.id)}
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-body-xs text-foreground-secondary">
                            {position}/{renders.length}
                        </span>
                        <Button
                            variant="secondary"
                            size="small"
                            disabled={activeIndex === 0}
                            onClick={() => onSelect(activeIndex - 1)}
                            className="w-auto"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="secondary"
                            size="small"
                            disabled={activeIndex >= renders.length - 1}
                            onClick={() => onSelect(activeIndex + 1)}
                            className="w-auto"
                        >
                            Next
                        </Button>
                    </div>
                </footer>
            </aside>
        </div>
    )
}
