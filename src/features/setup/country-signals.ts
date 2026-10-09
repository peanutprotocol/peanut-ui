'use client'

import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rawDeviceTag } from '@/i18n/app/locale-store'
import { getApiBaseUrl } from '@/utils/capacitor'
import { normalizeCountrySignal } from '@/utils/country-signal'

export const SETUP_EDGE_COUNTRY_TIMEOUT_MS = 1500

export type SetupCountrySignals = {
    vercelIpCountry: string | null
    edgeSettled: boolean
    ipCountry: string | null
    deviceLanguage: string | null
    browserLanguages: string[]
    deviceTimezone: string | null
    collectedAt: string | null
}

export const EMPTY_SETUP_COUNTRY_SIGNALS: SetupCountrySignals = {
    vercelIpCountry: null,
    edgeSettled: false,
    ipCountry: null,
    deviceLanguage: null,
    browserLanguages: [],
    deviceTimezone: null,
    collectedAt: null,
}

let signals = EMPTY_SETUP_COUNTRY_SIGNALS
let started: Promise<void> | null = null
const listeners = new Set<() => void>()

export const currentSetupCountrySignals = () => signals
export const serverSetupCountrySignals = () => EMPTY_SETUP_COUNTRY_SIGNALS
export function subscribeSetupCountrySignals(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function setupCountrySuggestion(snapshot: SetupCountrySignals, offered?: readonly string[]) {
    const isOffered = (country: string | null) => country && (!offered || offered.includes(country))
    if (isOffered(snapshot.vercelIpCountry)) {
        return { country: snapshot.vercelIpCountry!, source: 'vercel_ip_country' as const }
    }
    // Do not let a faster IP lookup take precedence over the edge lookup.
    if (snapshot.edgeSettled && isOffered(snapshot.ipCountry)) {
        return { country: snapshot.ipCountry!, source: 'ipapi' as const }
    }
    return null
}

export function setupCountrySignalProperties(snapshot = signals) {
    const suggestion = setupCountrySuggestion(snapshot)
    return {
        signup_vercel_ip_country: snapshot.vercelIpCountry,
        signup_ip_country: snapshot.ipCountry,
        signup_device_language: snapshot.deviceLanguage,
        signup_browser_languages: snapshot.browserLanguages,
        signup_device_timezone: snapshot.deviceTimezone,
        signup_country_signals_collected_at: snapshot.collectedAt,
        signup_country_edge_status: snapshot.edgeSettled ? 'settled' : 'pending',
        signup_country_suggestion: suggestion?.country ?? null,
        signup_country_suggestion_source: suggestion?.source ?? null,
    }
}

function publish(patch: Partial<SetupCountrySignals>) {
    const next = { ...signals, ...patch }
    if (JSON.stringify(next) === JSON.stringify(signals)) return
    signals = next
    for (const listener of listeners) listener()
    try {
        const properties = setupCountrySignalProperties()
        posthog.register(properties)
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_COUNTRY_SIGNALS_CAPTURED, properties)
        if (posthog._isIdentified()) posthog.setPersonProperties(properties)
    } catch {
        // A failed analytics emit must not affect a country suggestion.
    }
}

export function recordSetupIpCountry(country: string | null) {
    publish({ ipCountry: normalizeCountrySignal(country) })
}

async function readEdgeCountry() {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        const result = await Promise.race([
            fetch(`${getApiBaseUrl()}/api/geo-country`, {
                signal: controller.signal,
                credentials: 'omit',
                cache: 'no-store',
            }).then(async (response) => {
                if (!response.ok) return null
                const body: unknown = await response.json()
                return normalizeCountrySignal(
                    body && typeof body === 'object' && 'country' in body ? body.country : null
                )
            }),
            new Promise<null>((resolve) => {
                timeout = setTimeout(() => {
                    resolve(null)
                    controller.abort()
                }, SETUP_EDGE_COUNTRY_TIMEOUT_MS)
            }),
        ])
        publish({ vercelIpCountry: result, edgeSettled: true })
    } catch {
        publish({ vercelIpCountry: null, edgeSettled: true })
    } finally {
        clearTimeout(timeout)
    }
}

/** Started at setup entry; shared across mounts and the residence screen. */
export function startSetupCountrySignals(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (!started) {
        let deviceTimezone: string | null = null
        try {
            deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
        } catch {}
        const browserLanguages = Array.from(navigator.languages?.length ? navigator.languages : [navigator.language])
            .filter((tag): tag is string => typeof tag === 'string' && !!tag.trim())
            .slice(0, 10)
            .map((tag) => tag.trim().toLowerCase().slice(0, 64))
        publish({ deviceTimezone, browserLanguages, collectedAt: new Date().toISOString() })
        started = Promise.all([
            readEdgeCountry(),
            rawDeviceTag()
                .then((tag) => publish({ deviceLanguage: tag?.trim().toLowerCase().slice(0, 64) || null }))
                .catch(() => {}),
        ]).then(() => {})
    }
    return started
}
