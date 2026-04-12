import posthog from 'posthog-js'

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: '/ingest',
        ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
    })

    // Brave identifies as Chrome in User-Agent — detect it and set a person property
    // so we can accurately measure our crypto-native Brave audience in PostHog
    if (navigator.brave) {
        navigator.brave.isBrave().then((isBrave) => {
            if (isBrave) {
                posthog.setPersonProperties({ browser_override: 'Brave' })
            }
        })
    }
}
