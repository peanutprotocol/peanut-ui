'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { Card } from '@/components/0_Bruddle/Card'
import { OUTSIDE_LANE, cadenceLabel, groupFunnelMap } from './funnelMap'
import type { FunnelMapEntry } from './journeyTypes'

/**
 * The live funnel map (GET /__dev/journey-spec `funnelMap`, api#2307): every registered notification template by
 * funnel lane, with its trigger, channels and cadence. It replaces the 18 Nov snapshot in mono
 * projects/funnel-notifications/map/.
 */
export default function FunnelMapBoard({
    entries,
    specError,
}: {
    entries: FunnelMapEntry[] | undefined
    specError: string | null
}) {
    if (!entries) {
        return (
            <Callout priority={specError ? 'error' : 'info'}>
                {specError ?? 'The running API sends no funnel map: start it with api#2307 or later.'}
            </Callout>
        )
    }
    return (
        <div className="flex flex-col gap-3">
            <p className="text-body-xs text-foreground-secondary">
                Event: a state change sends it at once. Timer: the nudge engine sends it at each rung, counted from when
                the user entered the step. &quot;email stands in&quot; means an email goes when the push cannot reach
                the user.
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groupFunnelMap(entries).map(({ lane, entries: laneEntries }) => (
                    <Card key={lane} className="p-3">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-label-l">{lane === OUTSIDE_LANE ? 'outside the funnel' : lane}</span>
                            <span className="text-label-m text-foreground-secondary">{laneEntries.length}</span>
                        </div>
                        <ul className="mt-2 flex flex-col gap-2">
                            {laneEntries.map((entry) => (
                                <li key={entry.type}>
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-mono text-body-xs break-all">{entry.type}</span>
                                        <span className="shrink-0 text-label-m">{cadenceLabel(entry)}</span>
                                    </div>
                                    <p className="text-body-xs text-foreground-secondary">
                                        {entry.funnel === 'outside' ? 'not a funnel message' : entry.funnel.trigger} ·{' '}
                                        {entry.channels.join(' + ') || 'no channel'}
                                        {entry.emailStandsInForPush && ' · email stands in'}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </Card>
                ))}
            </div>
        </div>
    )
}
