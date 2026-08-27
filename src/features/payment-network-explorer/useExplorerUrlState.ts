'use client'

import { createParser, parseAsArrayOf, parseAsInteger, parseAsStringEnum, useQueryStates } from 'nuqs'
import { useCallback } from 'react'
import { DEFAULT_TOP_NODES, isPlainUsername } from './query'
import {
    EDGE_DIRECTION_FILTERS,
    P2P_EDGE_TYPES,
    type EdgeDirectionFilter,
    type ExplorerFilters,
    type P2PEdgeType,
} from './types'

const parseAsUsername = createParser({
    parse: (value) => (isPlainUsername(value) ? value : null),
    serialize: (value: string) => value,
})

const parseAsBoundedCount = createParser({
    parse: (value) => {
        const parsed = Number.parseInt(value, 10)
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    },
    serialize: (value: number) => String(value),
})

const parsers = {
    view: parseAsStringEnum<'graph' | 'table'>(['graph', 'table']).withDefault('graph'),
    types: parseAsArrayOf(parseAsStringEnum<P2PEdgeType>([...P2P_EDGE_TYPES])).withDefault([]),
    dir: parseAsStringEnum<EdgeDirectionFilter>([...EDGE_DIRECTION_FILTERS]).withDefault('all'),
    minCount: parseAsBoundedCount.withDefault(0),
    minUsd: parseAsBoundedCount.withDefault(0),
    top: parseAsInteger.withDefault(DEFAULT_TOP_NODES),
    user: parseAsUsername,
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
                ...(patch.types !== undefined ? { types: patch.types } : {}),
                ...(patch.direction !== undefined ? { dir: patch.direction } : {}),
                ...(patch.minCount !== undefined ? { minCount: patch.minCount } : {}),
                ...(patch.minUsd !== undefined ? { minUsd: patch.minUsd } : {}),
                ...(patch.topNodes !== undefined ? { top: patch.topNodes } : {}),
                ...(patch.focus !== undefined ? { user: patch.focus } : {}),
            })
        },
        [setUrlState]
    )

    return {
        filters: {
            view: state.view,
            types: state.types,
            direction: state.dir,
            minCount: state.minCount,
            minUsd: state.minUsd,
            topNodes: state.top >= 0 ? state.top : DEFAULT_TOP_NODES,
            focus: state.user,
        },
        setFilters,
    }
}
