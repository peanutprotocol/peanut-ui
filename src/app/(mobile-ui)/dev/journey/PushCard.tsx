'use client'

import { Card } from '@/components/0_Bruddle/Card'
import type { SpecPushReminder } from './journeyTypes'

/** Compact card for one push reminder from the live spec. */
export default function PushCard({ push, showDev }: { push: SpecPushReminder; showDev: boolean }) {
    return (
        <Card className="p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="text-label-m leading-tight">{push.title}</div>
                <span className="text-label-m text-foreground-secondary">after {push.afterMinutes}min</span>
            </div>
            <p className="mt-1 text-body-xs leading-snug text-foreground-secondary">{push.note}</p>
            {showDev && (
                <p className="mt-2 font-mono text-body-xs leading-tight text-foreground-secondary">
                    {push.type} · {push.channels.join(' + ')}
                </p>
            )}
        </Card>
    )
}
