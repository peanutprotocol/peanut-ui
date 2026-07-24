'use client'

import type { InAppSurface } from './journeyTypes'

const KIND_LABEL: Record<InAppSurface['kind'], string> = {
    step: 'home step',
    carousel: 'carousel',
    modal: 'modal',
    'card-screen': '/card',
}

/** Compact card for one in-app surface inside a journey-board column. */
export default function SurfaceCard({ surface }: { surface: InAppSurface }) {
    return (
        <div className="rounded-sm border border-n-1 bg-white p-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold leading-tight">{surface.name}</div>
                <div className="flex shrink-0 gap-1">
                    {surface.isNewInThisPr && (
                        <span className="rounded-sm border border-n-1 bg-green-1 px-1 py-0.5 text-[9px] font-bold uppercase">
                            NEW in this PR
                        </span>
                    )}
                    <span className="rounded-sm border border-n-1 bg-primary-3 px-1 py-0.5 text-[9px] font-bold uppercase">
                        {KIND_LABEL[surface.kind]}
                    </span>
                </div>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-n-1">{surface.copy}</p>
            {surface.cta && (
                <p className="mt-1 text-[11px] leading-snug">
                    <span className="rounded-sm bg-yellow-1 px-1 font-bold">{surface.cta.label}</span>
                    <span className="text-grey-1"> → {surface.cta.dest}</span>
                </p>
            )}
            <p className="mt-1 text-[10px] italic leading-snug text-grey-1">{surface.condition}</p>
            {surface.note && <p className="mt-1 text-[10px] leading-snug text-grey-1">{surface.note}</p>}
            <p className="mt-1.5 break-all font-mono text-[9px] leading-tight text-grey-1">{surface.sourceFile}</p>
        </div>
    )
}
