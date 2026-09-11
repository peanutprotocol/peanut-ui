'use client'
import { useEffect, useState } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { isPwaSunsetOn } from '@/utils/migration.utils'

/**
 * Read the migration flag after hydration and subscribe to PostHog updates.
 * PR previews bypass the flag so reviewers can exercise web signup. Staging
 * keeps both flag states available to QA. For local or staging QA, set
 * localStorage['pwa-sunset'] = 'true' and reload.
 */
export function useMigrationFlag(): boolean {
    useFeatureFlags()
    // Cached flags can resolve before hydration; match the server's flag-off HTML first.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return mounted && isPwaSunsetOn()
}
