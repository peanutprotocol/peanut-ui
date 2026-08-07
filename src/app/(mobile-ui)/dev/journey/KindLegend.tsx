'use client'

import DevChip from '../_components/DevChip'
import { SURFACE_KIND_META, SURFACE_KIND_ORDER } from './surfaceKindMeta'

/**
 * Explains the surface-kind chips used across the board. Without it the
 * taxonomy (HOME STEP / CAROUSEL / MODAL / /CARD) is unexplained shorthand.
 */
export default function KindLegend() {
    return (
        <div className="grid gap-2 rounded-sm border border-n-1 bg-white p-3 sm:grid-cols-2 xl:grid-cols-4">
            {SURFACE_KIND_ORDER.map((kind) => {
                const meta = SURFACE_KIND_META[kind]
                return (
                    <div key={kind} className="flex flex-col gap-1">
                        <DevChip tone={meta.tone} className="self-start">
                            {meta.label}
                        </DevChip>
                        <p className="text-[11px] leading-snug text-grey-1">{meta.description}</p>
                    </div>
                )
            })}
        </div>
    )
}
