'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { KEEP_WEB_COOKIE, KEEP_WEB_COOKIE_DAYS, KEEP_WEB_TOKEN } from '@/constants/migration.consts'
import { getFromCookie, saveToCookie } from '@/utils/general.utils'

/**
 * Support escape hatch for the sunset block: `?keep-web=<token>` (DM'd by
 * support) persists a 90-day cookie that lets this browser keep using the web
 * app. Shared by every layout that renders the sunset gate so the token works
 * no matter which route the user lands on.
 */
export function useKeepWebBypass(): boolean {
    const [hasBypass, setHasBypass] = useState(
        () => typeof document !== 'undefined' && getFromCookie(KEEP_WEB_COOKIE) === KEEP_WEB_TOKEN
    )
    useEffect(() => {
        const param = new URLSearchParams(window.location.search).get(KEEP_WEB_COOKIE)
        if (param === KEEP_WEB_TOKEN) {
            saveToCookie(KEEP_WEB_COOKIE, KEEP_WEB_TOKEN, KEEP_WEB_COOKIE_DAYS)
            posthog.capture(ANALYTICS_EVENTS.MIGRATION_KEEP_WEB_USED)
            setHasBypass(true)
        }
    }, [])
    return hasBypass
}
