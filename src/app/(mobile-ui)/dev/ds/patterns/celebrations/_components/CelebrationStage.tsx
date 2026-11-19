'use client'

import { useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import Badge from '@/components/Global/Badges/Badge'
import { Button } from '@/components/0_Bruddle/Button'

/**
 * Frame for one permitted celebration: a fixed 320 px stage, a replay button
 * and the "not in the app" label. Replay remounts the demo, which restarts it.
 */
export function CelebrationStage({
    name,
    idea,
    reducedIdea,
    height,
    children,
}: {
    name: string
    idea: string
    reducedIdea: string
    height: number
    children: (reduced: boolean) => ReactNode
}) {
    const [run, setRun] = useState(0)
    const reduced = useReducedMotion() ?? false
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-heading-card">{name}</p>
                <Badge status="custom" customText="Not used in the app" />
            </div>
            <p className="text-body-s text-foreground-secondary">{idea}</p>
            <p className="text-body-s text-foreground-secondary">Reduced motion: {reducedIdea}</p>
            <div className="overflow-hidden rounded-sm border border-dashed border-border-default bg-background-page py-2">
                <div key={run} className="relative mx-auto w-[320px] max-w-full" style={{ height }}>
                    {children(reduced)}
                </div>
            </div>
            <Button variant="secondary" size="small" className="w-auto" onClick={() => setRun((count) => count + 1)}>
                Replay
            </Button>
        </div>
    )
}
