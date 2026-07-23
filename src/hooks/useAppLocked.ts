'use client'

// React binding for the app-lock registry, kept separate from
// utils/app-lock-state.ts so that auth-token.ts (reachable from Server
// Component module graphs) never pulls a React hook in.

import { useSyncExternalStore } from 'react'
import { getLockState, subscribeLockState } from '@/utils/app-lock-state'

export function useAppLocked(): boolean {
    return useSyncExternalStore(
        subscribeLockState,
        () => getLockState() === 'locked',
        () => false
    )
}
