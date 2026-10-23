/**
 * Kept self-contained because the standalone handoff embeds this function.
 * PostHog 1.428.4 uses this default key in localStorage (or a same-name cookie).
 * Do not initialize the SDK or change storage to inspect its preference.
 */
export function marketingQrAnalyticsAllowed(projectKey = process.env.NEXT_PUBLIC_POSTHOG_KEY): boolean {
    try {
        projectKey = projectKey?.trim()
        if (!projectKey) return false
        // Next folds `typeof window` in server bundles. Keep browser access
        // inside this try so the serialized function still runs in the scanner.
        const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string }
        const privacyWindow = window as Window & { doNotTrack?: string }
        if (
            privacyNavigator.globalPrivacyControl ||
            [navigator.doNotTrack, privacyNavigator.msDoNotTrack, privacyWindow.doNotTrack].some(
                (value) => value === '1' || value === 'yes'
            )
        )
            return false
        const key = `__ph_opt_in_out_${projectKey}`
        const stored = window.localStorage.getItem(key)
        const cookies = document.cookie
            .split(';')
            .map((part) => part.trim())
            .filter((part) => part.startsWith(`${key}=`))
            .map((part) => decodeURIComponent(part.slice(key.length + 1)))
        for (const value of [stored, ...cookies]) {
            if (value === null) continue
            if (!['1', 'true', 'yes'].includes(value)) return false
        }
        return true
    } catch {
        return false
    }
}
