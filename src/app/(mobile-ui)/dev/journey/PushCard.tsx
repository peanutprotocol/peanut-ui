'use client'

import DevChip from '../_components/DevChip'
import type { SpecPushReminder } from './journeyTypes'

/** Compact card for one push reminder from the live spec. */
export default function PushCard({ push, showDev }: { push: SpecPushReminder; showDev: boolean }) {
    return (
        <div className="rounded-sm border border-border-default bg-white p-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="text-label-m leading-tight">{push.title}</div>
                <DevChip tone="yellow">after {push.afterMinutes}min</DevChip>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-foreground-secondary">{push.note}</p>
            {showDev && (
                <p className="mt-1.5 font-mono text-[9px] leading-tight text-foreground-secondary">
                    {push.type} · {push.channels.join(' + ')}
                </p>
            )}
        </div>
    )
}
