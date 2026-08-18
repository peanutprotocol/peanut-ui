'use client'

import DevChip from '../_components/DevChip'
import type { InAppSurface } from './journeyTypes'
import { SURFACE_KIND_META } from './surfaceKindMeta'

/** Compact card for one in-app surface inside a journey-board column. */
export default function SurfaceCard({ surface, showDev }: { surface: InAppSurface; showDev: boolean }) {
    const kind = SURFACE_KIND_META[surface.kind]

    return (
        <div className="rounded-sm border border-n-1 bg-white p-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="text-xs leading-tight font-bold">{surface.name}</div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {surface.isNewInThisPr && <DevChip tone="ink">NEW in this PR</DevChip>}
                    <DevChip tone={kind.tone} title={kind.description}>
                        {kind.label}
                    </DevChip>
                </div>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-n-1">{surface.copy}</p>
            {surface.cta && (
                <p className="mt-1 text-[11px] leading-snug">
                    <span className="rounded-sm bg-yellow-1 px-1 font-bold">{surface.cta.label}</span>
                    <span className="text-grey-1"> → {surface.cta.dest}</span>
                </p>
            )}
            {surface.note && <p className="mt-1 text-[10px] leading-snug text-grey-1">{surface.note}</p>}
            {showDev && (
                <>
                    <p className="mt-1 text-[10px] leading-snug text-grey-1 italic">{surface.condition}</p>
                    <p className="mt-1.5 font-mono text-[9px] leading-tight break-all text-grey-1">
                        {surface.sourceFile}
                    </p>
                </>
            )}
        </div>
    )
}
