import { useState, useEffect, useCallback, useRef } from 'react'
import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'
import type {
    ActivityFilter,
    ForceConfig,
    VisibilityConfig,
    ExternalNodesConfig,
} from '@/components/Global/InvitesGraph'

const GRAPH_PREFS_KEY = 'invite-graph-preferences'
const PAYMENT_GRAPH_PREFS_KEY = 'payment-graph-preferences'

export interface GraphPreferences {
    forceConfig?: ForceConfig
    visibilityConfig?: VisibilityConfig
    activityFilter?: ActivityFilter
    externalNodesConfig?: ExternalNodesConfig
    showUsernames?: boolean
    /** Top N nodes limit (0 = all nodes). Backend-filtered. */
    topNodes?: number
}

/**
 * Hook to persist and restore graph preferences to localStorage
 * Saves: force config, visibility, activity filter, external nodes config, display settings
 * Does NOT save: camera position (too heavy, changes frequently)
 *
 * IMPORTANT: savePreferences does NOT update state to avoid infinite loops
 * It only writes to localStorage. preferences state is only set on initial load.
 *
 * @param mode - 'full' for full-graph, 'payment' for payment-graph (separate storage keys)
 */
export function useGraphPreferences(mode: 'full' | 'payment' = 'full') {
    const [preferences, setPreferences] = useState<GraphPreferences | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const initialPrefsRef = useRef<GraphPreferences | null>(null)

    const storageKey = mode === 'payment' ? PAYMENT_GRAPH_PREFS_KEY : GRAPH_PREFS_KEY

    // Load preferences on mount
    useEffect(() => {
        const saved = getFromLocalStorage(storageKey) as GraphPreferences | null
        if (saved) {
            setPreferences(saved)
            initialPrefsRef.current = saved
        }
        setIsLoaded(true)
    }, [storageKey])

    // Save preferences to localStorage ONLY - does NOT update state to avoid loops
    const savePreferences = useCallback(
        (prefs: GraphPreferences) => {
            saveToLocalStorage(storageKey, prefs)
            // Don't call setPreferences here - it causes infinite loops
        },
        [storageKey]
    )

    // Clear all preferences
    const clearPreferences = useCallback(() => {
        setPreferences(null)
        initialPrefsRef.current = null
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(storageKey)
        }
    }, [storageKey])

    return {
        preferences,
        savePreferences,
        clearPreferences,
        isLoaded,
    }
}
