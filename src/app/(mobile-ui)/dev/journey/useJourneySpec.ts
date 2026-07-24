'use client'

import { useEffect, useState } from 'react'
import { JOURNEY_API_BASE } from './journeyData'
import type { JourneySpec } from './journeyTypes'

/**
 * Fetches the live email-machine spec from the sandbox API. Degrades
 * gracefully: when the running API predates api PR #1234 (no __dev/journey-spec
 * route) or isn't up at all, `error` is set and the board renders the in-app
 * half with a "spec unavailable" note in the email panels.
 */
export function useJourneySpec(): { spec: JourneySpec | null; error: string | null; loading: boolean } {
    const [spec, setSpec] = useState<JourneySpec | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        fetch(`${JOURNEY_API_BASE}/__dev/journey-spec`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return (await res.json()) as JourneySpec
            })
            .then((data) => {
                if (cancelled) return
                if (!Array.isArray(data.stages) || !Array.isArray(data.pushReminders) || !data.rules || !data.welcome)
                    throw new Error('unexpected spec shape')
                setSpec(data)
            })
            .catch(() => {
                if (!cancelled)
                    setError('API spec unavailable — start the sandbox with PR #1234 code (DEV_EMAIL_PREVIEW=true)')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    return { spec, error, loading }
}
