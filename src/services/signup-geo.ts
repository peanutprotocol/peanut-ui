import { apiFetch } from '@/utils/api-fetch'
import {
    currentSetupCountrySignals,
    startSetupCountrySignals,
    subscribeSetupCountrySignals,
    type SetupCountrySignals,
} from '@/features/setup/country-signals'

export function signupGeoPayload(snapshot: SetupCountrySignals) {
    const observedAt = snapshot.collectedAt
    if (!observedAt) return null
    return {
        ...(snapshot.vercelIpCountry && { vercelIp: { country: snapshot.vercelIpCountry, observedAt } }),
        ...(snapshot.ipCountry && {
            ipProvider: { country: snapshot.ipCountry, provider: 'ipapi' as const, observedAt },
        }),
        ...(snapshot.storeCountry &&
            snapshot.storeCountryCollectedAt && {
                store: {
                    country: snapshot.storeCountry.countryCode,
                    source: snapshot.storeCountry.source,
                    observedAt: snapshot.storeCountryCollectedAt,
                },
            }),
        ...((snapshot.deviceLanguage || snapshot.browserLanguages?.length || snapshot.deviceTimezone) && {
            device: {
                locale: snapshot.deviceLanguage ?? null,
                languages: snapshot.browserLanguages ?? [],
                timeZone: snapshot.deviceTimezone ?? null,
                observedAt,
            },
        }),
    }
}

/** Bounded to this signup and user; late signals fill only previously missing sources. */
export function attachSignupGeo(userId: string): void {
    let stopped = false
    let inFlight = false
    let dirty = true
    const send = async () => {
        dirty = true
        if (inFlight || stopped) return
        inFlight = true
        try {
            while (dirty && !stopped) {
                dirty = false
                const signup = signupGeoPayload(currentSetupCountrySignals())
                if (!signup || !Object.keys(signup).length) continue
                const response = await apiFetch('/users/me/geo', {
                    method: 'POST',
                    body: JSON.stringify({ expectedUserId: userId, signup }),
                    timeoutMs: 3000,
                    redactTelemetry: true,
                })
                // A switched session must never receive the earlier account's observations.
                if (response.status === 409) stop()
            }
        } catch {
            // Observations cannot delay or fail signup; a later signal retries delivery.
        } finally {
            inFlight = false
        }
    }
    const unsubscribe = subscribeSetupCountrySignals(() => {
        void send()
    })
    const stop = () => {
        stopped = true
        unsubscribe()
        clearTimeout(deadline)
    }
    const deadline = setTimeout(stop, 10000)
    void startSetupCountrySignals().then(send).catch(stop)
}
