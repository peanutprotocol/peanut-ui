'use client'

import { createContext, useContext } from 'react'
import { createShellStore, type ShellStore } from './shellStore'

export type SetupShellContextValue = {
    store: ShellStore
    /** The OS asks for less motion: every step is a 200 ms crossfade, art shows its hold frame. */
    reducedMotion: boolean
    /** The entering screen's slide has come to rest (releases the navigation lock). */
    onEntered?: (slideKey: string) => void
}

export const SetupShellContext = createContext<SetupShellContextValue | null>(null)

/** A screen rendered alone (a unit test, a fixture) draws its layers; nothing reads its footer. */
const STANDALONE: SetupShellContextValue = { store: createShellStore(), reducedMotion: true }

/** One step slide. `key` names the screen it carries; `direction` is 1 forward, -1 back, 0 first paint. */
export type SetupSlideContextValue = { key: string; direction: number }

export const SetupSlideContext = createContext<SetupSlideContextValue>({ key: 'standalone', direction: 0 })

export function useSetupShell(): SetupShellContextValue {
    return useContext(SetupShellContext) ?? STANDALONE
}
