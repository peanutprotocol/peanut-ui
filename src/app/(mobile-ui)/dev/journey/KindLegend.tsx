'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { SURFACE_KIND_META, SURFACE_KIND_ORDER } from './surfaceKindMeta'

/**
 * Explains the surface-kind chips used across the board. Without it the
 * taxonomy (HOME STEP / CAROUSEL / MODAL / /CARD) is unexplained shorthand.
 */
export default function KindLegend() {
    return (
        <Card className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
            {SURFACE_KIND_ORDER.map((kind) => {
                const meta = SURFACE_KIND_META[kind]
                return (
                    <div key={kind} className="flex flex-col gap-1">
                        <span className="text-label-m text-foreground-primary">{meta.label}</span>
                        <p className="text-body-xs leading-snug text-foreground-secondary">{meta.description}</p>
                    </div>
                )
            })}
        </Card>
    )
}
