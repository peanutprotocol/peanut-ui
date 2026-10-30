'use client'
import { useEffect, useState } from 'react'
import { isPwaSunsetOn } from '@/utils/migration.utils'

/**
 * Is web signup closed here (see isPwaSunsetOn)? Vercel preview deployments
 * (PR previews and staging) keep it open. To QA the closed state locally, on
 * staging or on a preview, set localStorage['pwa-sunset'] = 'true' and reload.
 */
export function useMigrationFlag(): boolean {
    // The QA override lives in localStorage; match the server's HTML on the first render.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return mounted && isPwaSunsetOn()
}
