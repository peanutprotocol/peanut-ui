'use client'

import { Card } from '@/components/0_Bruddle/Card'
import type { InAppSurface } from './journeyTypes'
import { SURFACE_KIND_META } from './surfaceKindMeta'

/** Compact card for one in-app surface inside a journey-board column. */
export default function SurfaceCard({ surface, showDev }: { surface: InAppSurface; showDev: boolean }) {
    const kind = SURFACE_KIND_META[surface.kind]

    return (
        <Card className="p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="text-label-m leading-tight">{surface.name}</div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {surface.isNewInThisPr && <span className="text-label-m">new in this PR</span>}
                    <span className="text-label-m text-foreground-secondary" title={kind.description}>
                        {kind.label}
                    </span>
                </div>
            </div>
            <p className="mt-1 text-body-xs leading-snug text-foreground-primary">{surface.copy}</p>
            {surface.cta && (
                <p className="mt-1 text-body-xs leading-snug">
                    <strong>{surface.cta.label}</strong>
                    <span className="text-foreground-secondary"> → {surface.cta.dest}</span>
                </p>
            )}
            {surface.note && <p className="mt-1 text-body-xs leading-snug text-foreground-secondary">{surface.note}</p>}
            {showDev && (
                <>
                    <p className="mt-1 text-body-xs leading-snug text-foreground-secondary italic">
                        {surface.condition}
                    </p>
                    <p className="mt-2 font-mono text-body-xs leading-tight break-all text-foreground-secondary">
                        {surface.sourceFile}
                    </p>
                </>
            )}
        </Card>
    )
}
