'use client'

import { createParser, parseAsArrayOf, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'
import { useCallback } from 'react'
import { isOpaqueFocusToken, sanitizeFilterValues } from './query'
import {
    MOVEMENT_STATES,
    RANGE_PRESETS,
    type ExplorerFilters,
    type InfrastructureMode,
    type MovementState,
    type RangePreset,
    type RelationshipDirection,
} from './types'

const DIRECTION_VALUES: RelationshipDirection[] = ['INCOMING', 'OUTGOING', 'INTERNAL']
const CODE_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/

const parseAsCode = createParser({
    parse: (value) => (CODE_PATTERN.test(value) ? value : null),
    serialize: (value: string) => value,
})

const parseAsFocus = createParser({
    parse: (value) => (isOpaqueFocusToken(value) ? value : null),
    serialize: (value: string) => value,
})

const parsers = {
    view: parseAsStringEnum<'graph' | 'table'>(['graph', 'table']).withDefault('graph'),
    range: parseAsStringEnum<RangePreset>([...RANGE_PRESETS]).withDefault('30d'),
    from: parseAsString,
    to: parseAsString,
    providers: parseAsArrayOf(parseAsCode).withDefault([]),
    methods: parseAsArrayOf(parseAsCode).withDefault([]),
    rails: parseAsArrayOf(parseAsCode).withDefault([]),
    kinds: parseAsArrayOf(parseAsCode).withDefault([]),
    assets: parseAsArrayOf(parseAsCode).withDefault([]),
    chains: parseAsArrayOf(parseAsCode).withDefault([]),
    states: parseAsArrayOf(parseAsStringEnum<MovementState>([...MOVEMENT_STATES])).withDefault(['SETTLED']),
    directions: parseAsArrayOf(parseAsStringEnum<RelationshipDirection>(DIRECTION_VALUES)).withDefault([]),
    infra: parseAsStringEnum<InfrastructureMode>(['edges', 'hubs']).withDefault('edges'),
    focus: parseAsFocus,
}

export interface ExplorerUrlState {
    filters: ExplorerFilters
    setFilters: (patch: Partial<ExplorerFilters>) => Promise<void>
}

export function useExplorerUrlState(): ExplorerUrlState {
    const [state, setUrlState] = useQueryStates(parsers, { history: 'replace', shallow: true })
    const setFilters = useCallback(
        async (patch: Partial<ExplorerFilters>) => {
            await setUrlState({
                ...(patch.view !== undefined ? { view: patch.view } : {}),
                ...(patch.range !== undefined ? { range: patch.range } : {}),
                ...(patch.customFrom !== undefined ? { from: patch.customFrom } : {}),
                ...(patch.customTo !== undefined ? { to: patch.customTo } : {}),
                ...(patch.providers !== undefined ? { providers: patch.providers } : {}),
                ...(patch.methods !== undefined ? { methods: patch.methods } : {}),
                ...(patch.rails !== undefined ? { rails: patch.rails } : {}),
                ...(patch.kinds !== undefined ? { kinds: patch.kinds } : {}),
                ...(patch.assets !== undefined ? { assets: patch.assets } : {}),
                ...(patch.chains !== undefined ? { chains: patch.chains } : {}),
                ...(patch.states !== undefined ? { states: patch.states } : {}),
                ...(patch.directions !== undefined ? { directions: patch.directions } : {}),
                ...(patch.infrastructure !== undefined ? { infra: patch.infrastructure } : {}),
                ...(patch.focus !== undefined ? { focus: patch.focus } : {}),
            })
        },
        [setUrlState]
    )

    return {
        filters: {
            view: state.view,
            range: state.range,
            customFrom: state.from,
            customTo: state.to,
            providers: sanitizeFilterValues(state.providers),
            methods: sanitizeFilterValues(state.methods),
            rails: sanitizeFilterValues(state.rails),
            kinds: sanitizeFilterValues(state.kinds),
            assets: sanitizeFilterValues(state.assets),
            chains: sanitizeFilterValues(state.chains),
            states: state.states,
            directions: state.directions,
            infrastructure: state.infra,
            focus: state.focus,
        },
        setFilters,
    }
}
