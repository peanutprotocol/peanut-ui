'use client'

import { useEffect } from 'react'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import DevChip from '../_components/DevChip'
import DevSegmented from '../_components/DevSegmented'
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
            <button
                type="button"
                aria-label="Close preview"
                onClick={onClose}
                className="absolute inset-0 cursor-default bg-n-1/40"
            />

            <aside className="relative flex h-full w-full max-w-full flex-col border-l-2 border-n-1 bg-white md:w-[640px]">
                <header className="flex flex-col gap-2 border-b border-n-1 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="text-sm font-bold leading-tight">{active.step.subject}</div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] text-grey-1">{active.eventType}</span>
                                {typeof active.step.afterDaysStuck === 'number' && (
                                    <StuckBadge days={active.step.afterDaysStuck} />
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close preview"
                            className="shrink-0 rounded-sm border border-n-1 px-2 py-1 text-xs font-bold hover:bg-primary-3/40"
                        >
                            esc ✕
                        </button>
                    </div>

                    {decision && (
                        <div className="flex flex-col gap-1 rounded-sm border border-n-1 bg-yellow-1/40 p-2">
                            <DevChip tone="pink" className="self-start">
                                {decision.label}
                            </DevChip>
                            <p className="text-[11px] leading-snug">{decision.note}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {siblings.length > 1 ? (
                            <DevSegmented
                                size="sm"
                                value={String(active.example)}
                                options={siblings.map((sibling) => ({
                                    value: String(sibling.example),
                                    label: sibling.exampleLabel,
                                    hint: `example=${sibling.example}`,
                                }))}
                                onChange={(next) =>
                                    onSelect(renders.findIndex((render) => render.id === `${active.eventType}#${next}`))
                                }
                            />
                        ) : (
                            <span className="text-[11px] text-grey-1">Single copy variant.</span>
                        )}
                        <a
                            href={emailPreviewUrl(active.eventType, active.example, false)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-black underline"
                        >
                            open raw ↗
                        </a>
                    </div>
                    <p className="text-[10px] leading-snug text-grey-1">
                        Frame blank? The API only allows the embed from localhost:3050 — use open raw ↗ instead.
                    </p>
                </header>

                <div className="min-h-0 flex-1 bg-primary-3/20">
                    <iframe
                        key={active.id}
                        title={`Email preview — ${active.eventType} example ${active.example}`}
                        src={emailPreviewUrl(active.eventType, active.example, true)}
                        className="h-full w-full border-0"
                    />
                </div>

                {/* pl-14 on mobile: the panel is full-screen there and the dev overlay badge sits bottom-left */}
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-n-1 p-3 pl-14 md:pl-3">
                    <Checkbox
                        label={reviewed ? 'Reviewed — copy approved' : 'Mark reviewed'}
                        value={reviewed}
                        onChange={() => onToggleReviewed(active.id)}
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-grey-1">
                            {position}/{renders.length}
                        </span>
                        <button
                            type="button"
                            disabled={activeIndex === 0}
                            onClick={() => onSelect(activeIndex - 1)}
                            className="rounded-sm border border-n-1 px-2.5 py-1 text-xs font-bold hover:bg-primary-3/40 disabled:opacity-30"
                        >
                            ← prev
                        </button>
                        <button
                            type="button"
                            disabled={activeIndex >= renders.length - 1}
                            onClick={() => onSelect(activeIndex + 1)}
                            className="rounded-sm border border-n-1 px-2.5 py-1 text-xs font-bold hover:bg-primary-3/40 disabled:opacity-30"
                        >
                            next →
                        </button>
                    </div>
                </footer>
            </aside>
        </div>
    )
}
