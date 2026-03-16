import posthog from 'posthog-js'

/**
 * Strips sensitive parameters from URLs before sending to PostHog.
 * Claim link passwords (p=) in hash fragments could be used to steal funds.
 * Also strips from query params and referrer as defense-in-depth.
 */
function sanitizeUrl(url: string): string {
    if (!url) return url
    try {
        const parsed = new URL(url, window.location.origin)
        // Strip 'p' from hash fragment (claim link password)
        if (parsed.hash) {
            const hashContent = parsed.hash.slice(1) // remove leading #
            const hashParams = new URLSearchParams(hashContent)
            if (hashParams.has('p')) {
                hashParams.set('p', 'REDACTED')
                parsed.hash = '#' + hashParams.toString()
            }
        }
        // Defense-in-depth: also strip from query params
        if (parsed.searchParams.has('p')) {
            parsed.searchParams.set('p', 'REDACTED')
        }
        return parsed.toString()
    } catch {
        // Fallback regex if URL parsing fails
        return url.replace(/([#?&])p=[^&#]*/g, '$1p=REDACTED')
    }
}

/** URL property keys that PostHog may capture */
const URL_PROPERTIES = ['$current_url', '$pathname', '$referrer', '$initial_referrer'] as const

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: '/ingest',
        ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        sanitize_properties: (properties, _event) => {
            for (const key of URL_PROPERTIES) {
                if (typeof properties[key] === 'string') {
                    properties[key] = sanitizeUrl(properties[key])
                }
            }
            return properties
        },
    })
}
