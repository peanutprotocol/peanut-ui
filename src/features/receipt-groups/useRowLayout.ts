'use client'

/**
 * Reads the `?rows=` switch (see row-layout.ts). One build serves both
 * renderings. The value is promoted to sessionStorage the way
 * `src/dev/fixtures/active.ts` promotes `__fixture`, so a flow that navigates
 * (the withdraw hub to its review) keeps it. Folds to today's rendering in a
 * production build (DEV_TOOLS_ENABLED is false there).
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { ROW_LAYOUT_PARAM, parseRowLayout, type RowLayout } from './row-layout'

const STORAGE_KEY = 'peanut_row_layout'

function peek(): string {
    if (!DEV_TOOLS_ENABLED || typeof window === 'undefined') return ''
    const fromUrl = new URLSearchParams(window.location.search).get(ROW_LAYOUT_PARAM)
    if (fromUrl !== null) return fromUrl
    try {
        return window.sessionStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
        return ''
    }
}

const subscribe = (onChange: () => void) => {
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
}

export function useRowLayout(): RowLayout {
    const raw = useSyncExternalStore(subscribe, peek, () => '')
    // promote the URL value to the session so the next route keeps it
    useEffect(() => {
        if (!DEV_TOOLS_ENABLED) return
        const fromUrl = new URLSearchParams(window.location.search).get(ROW_LAYOUT_PARAM)
        if (fromUrl === null) return
        try {
            window.sessionStorage.setItem(STORAGE_KEY, fromUrl)
        } catch {}
    }, [raw])
    return useMemo(() => parseRowLayout(raw), [raw])
}
