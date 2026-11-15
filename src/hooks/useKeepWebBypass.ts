'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { KEEP_WEB_COOKIE, KEEP_WEB_COOKIE_DAYS, KEEP_WEB_TOKEN } from '@/constants/migration.consts'
import { saveToCookie } from '@/utils/general.utils'
import { hasKeepWebCookie, isKeepWebLink } from '@/utils/migration.utils'
import { useHydrationSnapshot } from '@/utils/native-platform'

const serverCookieBypass = () => false

/**
 * Support escape hatch for closed web signup: `?keep-web=<token>` (DM'd by
 * support) persists a 90-day cookie that reopens signup in this browser, for
 * people who cannot install the app.
 */
export function useKeepWebBypass(): boolean {
    const cookieBypass = useHydrationSnapshot(hasKeepWebCookie, serverCookieBypass)
    const [queryBypass, setQueryBypass] = useState(false)
    useEffect(() => {
        const param = new URLSearchParams(window.location.search).get(KEEP_WEB_COOKIE)
        if (isKeepWebLink(param)) {
            saveToCookie(KEEP_WEB_COOKIE, KEEP_WEB_TOKEN, KEEP_WEB_COOKIE_DAYS)
            posthog.capture(ANALYTICS_EVENTS.MIGRATION_KEEP_WEB_USED)
            setQueryBypass(true)
        }
    }, [])
    return cookieBypass || queryBypass
}
