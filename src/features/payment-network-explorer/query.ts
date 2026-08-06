import {
    MOVEMENT_STATES,
    RANGE_PRESETS,
    type ExplorerFilters,
    type ExplorerRequest,
    type MovementState,
    type RangePreset,
    type RelationshipDirection,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_WINDOW_MS = DAY_MS
const MAX_WINDOW_MS = 120 * DAY_MS
const FILTER_VALUE_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/
const FOCUS_TOKEN_PATTERN = /^[A-Za-z0-9._~-]{24,2048}$/

const PRESET_DURATION_MS: Record<Exclude<RangePreset, 'custom'>, number> = {
    '24h': DAY_MS,
    '7d': 7 * DAY_MS,
    '30d': 30 * DAY_MS,
    '90d': 90 * DAY_MS,
    '120d': MAX_WINDOW_MS,
}

export class ExplorerWindowError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ExplorerWindowError'
    }
}

export function defaultExplorerFilters(): ExplorerFilters {
    return {
        view: 'graph',
        range: '30d',
        customFrom: null,
        customTo: null,
        providers: [],
        methods: [],
        rails: [],
        kinds: [],
        assets: [],
        chains: [],
        states: ['SETTLED'],
        directions: [],
        infrastructure: 'edges',
        focus: null,
    }
}

export function isRangePreset(value: string): value is RangePreset {
    return (RANGE_PRESETS as readonly string[]).includes(value)
}

export function isMovementState(value: string): value is MovementState {
    return (MOVEMENT_STATES as readonly string[]).includes(value)
}

export function isOpaqueFocusToken(value: string | null | undefined): value is string {
    return !!value && FOCUS_TOKEN_PATTERN.test(value)
}

export function sanitizeFilterValues(values: readonly string[]): string[] {
    return Array.from(new Set(values.filter((value) => FILTER_VALUE_PATTERN.test(value)))).sort()
}

function parseUtc(value: string | null, label: string): Date {
    if (!value) throw new ExplorerWindowError(`${label} is required.`)
    const parsed = new Date(value)
    if (!Number.isFinite(parsed.getTime())) throw new ExplorerWindowError(`${label} is invalid.`)
    return parsed
}

export function resolveExplorerWindow(
    filters: Pick<ExplorerFilters, 'range' | 'customFrom' | 'customTo'>,
    now = new Date()
): { from: string; to: string } {
    if (filters.range !== 'custom') {
        return {
            from: new Date(now.getTime() - PRESET_DURATION_MS[filters.range]).toISOString(),
            to: now.toISOString(),
        }
    }

    const from = parseUtc(filters.customFrom, 'Start time')
    const to = parseUtc(filters.customTo, 'End time')
    if (from >= to) throw new ExplorerWindowError('Start time must be before end time.')
    if (to.getTime() > now.getTime()) throw new ExplorerWindowError('End time cannot be in the future.')
    if (to.getTime() - from.getTime() < MIN_WINDOW_MS) {
        throw new ExplorerWindowError('Custom windows must cover at least 24 hours.')
    }
    if (to.getTime() - from.getTime() > MAX_WINDOW_MS) {
        throw new ExplorerWindowError('Custom windows cannot exceed 120 days.')
    }
    if (from.getTime() < now.getTime() - MAX_WINDOW_MS) {
        throw new ExplorerWindowError('Custom windows cannot look back more than 120 days.')
    }

    return { from: from.toISOString(), to: to.toISOString() }
}

export function buildExplorerRequest(filters: ExplorerFilters, now = new Date()): ExplorerRequest {
    const window = resolveExplorerWindow(filters, now)
    return {
        ...window,
        providers: sanitizeFilterValues(filters.providers),
        methods: sanitizeFilterValues(filters.methods),
        rails: sanitizeFilterValues(filters.rails),
        kinds: sanitizeFilterValues(filters.kinds),
        assets: sanitizeFilterValues(filters.assets),
        chains: sanitizeFilterValues(filters.chains),
        states: filters.states.filter(isMovementState),
        directions: sanitizeFilterValues(filters.directions) as RelationshipDirection[],
        includeHubs: filters.infrastructure === 'hubs',
        limit: 5000,
        focus: isOpaqueFocusToken(filters.focus) ? filters.focus : null,
    }
}

export function buildExplorerSearchParams(request: ExplorerRequest): URLSearchParams {
    const params = new URLSearchParams({
        mode: 'payment',
        from: request.from,
        to: request.to,
        states: request.states.join(','),
        includeHubs: String(request.includeHubs),
        limit: String(request.limit),
    })
    const listFields = [
        ['providers', request.providers],
        ['methods', request.methods],
        ['rails', request.rails],
        ['kinds', request.kinds],
        ['assets', request.assets],
        ['chains', request.chains],
        ['directions', request.directions],
    ] as const
    for (const [key, values] of listFields) {
        if (values.length > 0) params.set(key, values.join(','))
    }
    if (request.focus) params.set('focus', request.focus)
    return params
}

type LegacyLocation = Pick<Location, 'href'>
type LegacyHistory = Pick<History, 'replaceState' | 'state'>

/** Remove legacy secrets before React renders or any feature request starts. */
export function consumeLegacyGraphUsername(location: LegacyLocation, history: LegacyHistory): string | null {
    const url = new URL(location.href)
    const username = url.searchParams.get('user')?.trim() || null
    const mustScrub = url.searchParams.has('user') || url.searchParams.has('password')
    url.searchParams.delete('user')
    url.searchParams.delete('password')
    if (mustScrub) history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
    return username
}

export function toDateTimeLocal(iso: string | null): string {
    if (!iso) return ''
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) return ''
    return date.toISOString().slice(0, 16)
}

export function fromDateTimeLocal(value: string): string | null {
    if (!value) return null
    const date = new Date(`${value}Z`)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
}
