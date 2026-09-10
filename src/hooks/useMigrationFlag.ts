'use client'
import { useEffect, useState } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { isPwaSunsetOn } from '@/utils/migration.utils'

/**
 * Read the migration flag after hydration and subscribe to PostHog updates.
 * No automatic staging bypass: QA must exercise both flag states.
 * For local or preview QA, set localStorage['pwa-sunset'] = 'true' and reload.
 */
export function useMigrationFlag(): boolean {
    useFeatureFlags()
    // Cached flags can resolve before hydration; match the server's flag-off HTML first.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return mounted && isPwaSunsetOn()
}
