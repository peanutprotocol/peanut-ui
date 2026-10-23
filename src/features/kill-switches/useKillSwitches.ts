'use client'

import { useSyncExternalStore } from 'react'
import { DEFAULT_KILL_SWITCHES } from './kill-switches.consts'
import { getKillSwitches, subscribeKillSwitches } from './kill-switches-store'
import type { KillSwitches } from './kill-switches.types'

// the server render has no saved values, so hydration starts from the defaults
const getServerKillSwitches = () => DEFAULT_KILL_SWITCHES

/** Kill switches that re-render the component when new values arrive. */
export function useKillSwitches(): KillSwitches {
    return useSyncExternalStore(subscribeKillSwitches, getKillSwitches, getServerKillSwitches)
}
