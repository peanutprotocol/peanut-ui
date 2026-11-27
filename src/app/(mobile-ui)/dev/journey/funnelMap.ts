import type { FunnelMapEntry } from './journeyTypes'

/**
 * The lanes left to right, as the API's FUNNEL_LANES (notifications/registry.ts) lists them. Display order only:
 * a lane the API adds later is appended, never dropped.
 */
const LANE_ORDER = ['signup', 'verify', 'verified', 'method', 'funded', 'card', 'spend', 'after', 'inviter']

export const OUTSIDE_LANE = 'outside'

export interface FunnelLaneGroup {
    lane: string
    entries: FunnelMapEntry[]
}

/** The map's templates by lane, in funnel order, with the non-funnel templates last; timers after events. */
export function groupFunnelMap(entries: readonly FunnelMapEntry[]): FunnelLaneGroup[] {
    const byLane = new Map<string, FunnelMapEntry[]>()
    for (const entry of entries) {
        const lane = entry.funnel === 'outside' ? OUTSIDE_LANE : entry.funnel.lane
        byLane.set(lane, [...(byLane.get(lane) ?? []), entry])
    }
    const known = [...LANE_ORDER, OUTSIDE_LANE]
    const lanes = [
        ...LANE_ORDER.filter((lane) => byLane.has(lane)),
        ...[...byLane.keys()].filter((lane) => !known.includes(lane)),
        ...(byLane.has(OUTSIDE_LANE) ? [OUTSIDE_LANE] : []),
    ]
    const trigger = (entry: FunnelMapEntry) =>
        entry.funnel === 'outside' ? 2 : entry.funnel.trigger === 'event' ? 0 : 1
    return lanes.map((lane) => ({
        lane,
        entries: [...byLane.get(lane)!].sort(
            (a, b) => trigger(a) - trigger(b) || (a.afterMinutes[0] ?? 0) - (b.afterMinutes[0] ?? 0)
        ),
    }))
}

const HOUR = 60
const DAY = 24 * HOUR

/** One rung's wait: "at once", "+30 min", "+23 h", "+7 d". */
export function waitLabel(minutes: number): string {
    if (minutes <= 0) return 'at once'
    if (minutes < HOUR) return `+${minutes} min`
    if (minutes < DAY || minutes % DAY !== 0) return `+${Math.round((minutes / HOUR) * 10) / 10} h`
    return `+${minutes / DAY} d`
}

/**
 * When a template goes: an event message at once, a timer message at each rung after the user entered the step.
 * A timer without rungs (the welcome) goes on the engine's next cycle.
 */
export function cadenceLabel(entry: FunnelMapEntry): string {
    return entry.afterMinutes.length ? entry.afterMinutes.map(waitLabel).join(' · ') : 'next cycle'
}
