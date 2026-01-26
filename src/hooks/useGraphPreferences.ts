import { useState, useEffect, useCallback, useRef } from 'react'
import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'
import type {
    ActivityFilter,
    ForceConfig,
    VisibilityConfig,
    ExternalNodesConfig,
} from '@/components/Global/InvitesGraph/types'

const GRAPH_PREFS_KEY = 'invite-graph-preferences'

export interface GraphPreferences {
    forceConfig?: ForceConfig
    visibilityConfig?: VisibilityConfig
    activityFilter?: ActivityFilter
    externalNodesConfig?: ExternalNodesConfig
    showUsernames?: boolean
    showAllNodes?: boolean
}

/**
 * Hook to persist and restore graph preferences to localStorage
 * Saves: force config, visibility, activity filter, external nodes config, display settings
 * Does NOT save: camera position (too heavy, changes frequently)
 *
 * IMPORTANT: savePreferences does NOT update state to avoid infinite loops
 * It only writes to localStorage. preferences state is only set on initial load.
 */
export function useGraphPreferences() {
    const [preferences, setPreferences] = useState<GraphPreferences | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const initialPrefsRef = useRef<GraphPreferences | null>(null)

    // Load preferences on mount
    useEffect(() => {
        const saved = getFromLocalStorage(GRAPH_PREFS_KEY) as GraphPreferences | null
        if (saved) {
            setPreferences(saved)
            initialPrefsRef.current = saved
        }
        setIsLoaded(true)
    }, [])

    // Save preferences to localStorage ONLY - does NOT update state to avoid loops
    const savePreferences = useCallback((prefs: GraphPreferences) => {
        saveToLocalStorage(GRAPH_PREFS_KEY, prefs)
        // Don't call setPreferences here - it causes infinite loops
    }, [])

    // Clear all preferences
    const clearPreferences = useCallback(() => {
        setPreferences(null)
        initialPrefsRef.current = null
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(GRAPH_PREFS_KEY)
        }
    }, [])

    return {
        preferences,
        savePreferences,
        clearPreferences,
        isLoaded,
    }
}
